import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  CampaignLaunchOrchestratorError,
  getCampaignLaunchProgress,
} from "@/server/services/campaign-launch-orchestrator.service";

type RouteContext = {
  params: Promise<{ campaignId: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
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

    const { campaignId } = await params;
    const progress = await getCampaignLaunchProgress({
      campaignId,
      companyId: context.membership.companyId,
    });

    return NextResponse.json(progress);
  } catch (error) {
    if (error instanceof CampaignLaunchOrchestratorError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    console.error("GET_CAMPAIGN_PROGRESS_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to fetch campaign progress" },
      { status: 500 },
    );
  }
}
