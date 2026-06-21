import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { startCampaignForCompany } from "@/server/services/campaign.service";

type StartCampaignRouteContext = {
  params: Promise<{
    campaignId: string;
  }>;
};

export async function POST(
  _request: Request,
  { params }: StartCampaignRouteContext,
) {
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

    if (
      context.membership.role !== "OWNER" &&
      context.membership.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { message: "You do not have permission to start campaigns" },
        { status: 403 },
      );
    }

    const { campaignId } = await params;

    const campaign = await startCampaignForCompany(
      context.membership.companyId,
      campaignId,
    );

    return NextResponse.json({
      message: "Campaign started successfully",
      campaign,
    });
  } catch (error) {
    console.error("START_CAMPAIGN_ERROR:", error);

    if (
      error instanceof Error &&
      [
        "Campaign not found",
        "Campaign has no pending contacts",
      ].includes(error.message)
    ) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    if (
      error instanceof Error &&
      [
        "Only draft campaigns can be started",
        "Campaign template is no longer approved",
      ].includes(error.message)
    ) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    if (
      error instanceof Error &&
      error.message === "Insufficient wallet balance"
    ) {
      return NextResponse.json({ message: error.message }, { status: 402 });
    }

    return NextResponse.json(
      { message: "Unable to start campaign" },
      { status: 500 },
    );
  }
}
