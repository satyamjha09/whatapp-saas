import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  createCampaignForCompany,
  getCampaignsByCompany,
} from "@/server/services/campaign.service";
import { createCampaignSchema } from "@/server/validators/campaign.validator";

export async function GET() {
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

    const campaigns = await getCampaignsByCompany(
      context.membership.companyId,
    );

    return NextResponse.json({
      campaigns,
    });
  } catch (error) {
    console.error("GET_CAMPAIGNS_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to fetch campaigns" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
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
        { message: "You do not have permission to create campaigns" },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();

    const validation = createCampaignSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid campaign details",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const campaign = await createCampaignForCompany(
      context.membership.companyId,
      validation.data,
    );

    return NextResponse.json(
      {
        message: "Campaign created successfully",
        campaign,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE_CAMPAIGN_ERROR:", error);

    if (
      error instanceof Error &&
      (error.message.includes("BULK_CAMPAIGNS is not available") ||
        error.message === "Subscription is past due")
    ) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    if (
      error instanceof Error &&
      ["Template not found", "One or more contacts were not found"].includes(
        error.message,
      )
    ) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    if (
      error instanceof Error &&
      error.message.includes("This template requires")
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Unable to create campaign" },
      { status: 500 },
    );
  }
}
