import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import {
  CampaignLaunchOrchestratorError,
  confirmAndQueueCampaignLaunch,
} from "@/server/services/campaign-launch-orchestrator.service";

type RouteContext = {
  params: Promise<{ launchRunId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const { launchRunId } = await context.params;

  try {
    const launchRun = await confirmAndQueueCampaignLaunch({
      companyId: workspace.membership.companyId,
      launchRunId,
      actorUserId: workspace.user.id,
    });

    return NextResponse.json({ ok: true, launchRun });
  } catch (error) {
    if (error instanceof CampaignLaunchOrchestratorError) {
      return NextResponse.json(
        { ok: false, code: "CAMPAIGN_LAUNCH_ERROR", message: error.message },
        { status: 400 },
      );
    }

    throw error;
  }
}
