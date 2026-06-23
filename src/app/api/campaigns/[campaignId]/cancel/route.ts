import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { cancelScheduledCampaign } from "@/server/services/campaign-cancel.service";
import {
  assertSystemWritesAllowed,
  SystemMaintenanceModeError,
} from "@/server/services/system-maintenance-mode.service";

type RouteContext = {
  params: Promise<{ campaignId: string }>;
};

export async function POST(_request: Request, { params }: RouteContext) {
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

    await assertSystemWritesAllowed({
      operation: "Canceling campaigns",
    });

    const result = await cancelScheduledCampaign(
      context.membership.companyId,
      campaignId,
    );
    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "campaign.scheduled.canceled",
      entityType: "BulkMessageBatch",
      entityId: campaignId,
      metadata: result,
    });

    return NextResponse.json({
      message: "Scheduled campaign canceled successfully",
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
