import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import { createCampaignOutcomeSegment } from "@/server/services/campaign-retargeting.service";
import { createCampaignRetargetingSegmentSchema } from "@/server/validators/campaign-retargeting.validator";

type CampaignRetargetRouteContext = {
  params: Promise<{
    campaignId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: CampaignRetargetRouteContext,
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
        { message: "You do not have permission to create retargeting segments" },
        { status: 403 },
      );
    }

    try {
      await assertRoutePermission({ request, workspace: context });
    } catch (error) {
      return createRoutePermissionErrorResponse(error);
    }

    const body: unknown = await request.json();
    const validation = createCampaignRetargetingSegmentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          errors: validation.error.flatten().fieldErrors,
          message: "Invalid retargeting request",
        },
        { status: 400 },
      );
    }

    const { campaignId } = await params;
    const result = await createCampaignOutcomeSegment({
      actorUserId: context.user.id,
      campaignId,
      companyId: context.membership.companyId,
      preset: validation.data.preset,
      segmentName: validation.data.segmentName,
    });

    return NextResponse.json({
      message: "Retargeting segment created",
      ...result,
    });
  } catch (error) {
    console.error("CREATE_CAMPAIGN_RETARGETING_SEGMENT_ERROR:", error);

    if (error instanceof Error && error.message === "Campaign not found") {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to create retargeting segment",
      },
      { status: 400 },
    );
  }
}
