import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { cancelScheduledCampaign } from "@/server/services/campaign-cancel.service";
import {
  CampaignLaunchOrchestratorError,
  cancelCampaignLaunch,
} from "@/server/services/campaign-launch-orchestrator.service";
import {
  assertSystemWritesAllowed,
  SystemMaintenanceModeError,
} from "@/server/services/system-maintenance-mode.service";
import { assertRoutePermission, createRoutePermissionErrorResponse } from "@/server/auth/route-permission-guard";

type RouteContext = {
  params: Promise<{ campaignId: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { campaignId } = await params;
    const context = await getCurrentWorkspaceContext();

    if (!context) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (!context.membership) {
      return NextResponse.json( 
        { message: "Complete company onboarding first" },
        { status: 403 },
      );
    }
    if (!["OWNER", "ADMIN"].includes(context.membership.role)) {
      return NextResponse.json(
        { message: "Only owners and admins can cancel campaigns" },
        { status: 403 },
      );
    }

    try {
      await assertRoutePermission({ request, workspace: context });
    } catch (error) {
      return createRoutePermissionErrorResponse(error);
    }

    await assertSystemWritesAllowed({
      operation: "Canceling campaigns",
    });

    let result: unknown;
    let action = "campaign.scheduled.canceled";
    let entityType = "BulkMessageBatch";

    try {
      result = await cancelCampaignLaunch({
        actorUserId: context.user.id,
        campaignId,
        companyId: context.membership.companyId,
      });
      action = "campaign.launch.canceled";
      entityType = "CampaignLaunchRun";
    } catch (error) {
      if (!(error instanceof CampaignLaunchOrchestratorError)) {
        throw error;
      }

      result = await cancelScheduledCampaign(
        context.membership.companyId,
        campaignId,
      );
    }

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action,
      entityType,
      entityId: campaignId,
      metadata: JSON.parse(JSON.stringify(result)),
    });

    return NextResponse.json({
      message: "Campaign canceled successfully",
      result,
    });
  } catch (error) {
    console.error("CANCEL_SCHEDULED_CAMPAIGN_ERROR:", error);

    if (error instanceof SystemMaintenanceModeError) {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    if (
      error instanceof Error &&
      ["Campaign not found", "Only scheduled campaigns can be canceled"].includes(
        error.message,
      )
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Unable to cancel scheduled campaign" },
      { status: 500 },
    );
  }
}
