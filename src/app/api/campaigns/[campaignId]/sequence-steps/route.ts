import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  createCampaignSequenceStep,
  getCampaignSequenceSteps,
} from "@/server/services/campaign-sequence.service";
import { createCampaignSequenceStepSchema } from "@/server/validators/campaign.validator";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";

type CampaignSequenceStepsRouteContext = {
  params: Promise<{
    campaignId: string;
  }>;
};

export async function GET(
  request: Request,
  { params }: CampaignSequenceStepsRouteContext,
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

    try {
      await assertRoutePermission({ request, workspace: context });
    } catch (error) {
      return createRoutePermissionErrorResponse(error);
    }

    const { campaignId } = await params;
    const steps = await getCampaignSequenceSteps({
      campaignId,
      companyId: context.membership.companyId,
    });

    return NextResponse.json({ steps });
  } catch (error) {
    console.error("GET_CAMPAIGN_SEQUENCE_STEPS_ERROR:", error);

    if (error instanceof Error && error.message === "Campaign not found") {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Unable to fetch campaign sequence steps" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: CampaignSequenceStepsRouteContext,
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
        { message: "You do not have permission to manage sequences" },
        { status: 403 },
      );
    }

    try {
      await assertRoutePermission({ request, workspace: context });
    } catch (error) {
      return createRoutePermissionErrorResponse(error);
    }

    const body: unknown = await request.json();
    const validation = createCampaignSequenceStepSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          errors: validation.error.flatten().fieldErrors,
          message: "Invalid sequence step details",
        },
        { status: 400 },
      );
    }

    const { campaignId } = await params;
    const step = await createCampaignSequenceStep({
      campaignId,
      companyId: context.membership.companyId,
      input: validation.data,
    });

    return NextResponse.json(
      {
        message: "Campaign sequence step created",
        step,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE_CAMPAIGN_SEQUENCE_STEP_ERROR:", error);

    if (
      error instanceof Error &&
      ["Campaign not found", "Approved template not found"].includes(
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

    if (
      error instanceof Error &&
      error.message.includes("Unique constraint failed")
    ) {
      return NextResponse.json(
        { message: "A sequence step with this order already exists" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { message: "Unable to create campaign sequence step" },
      { status: 500 },
    );
  }
}
