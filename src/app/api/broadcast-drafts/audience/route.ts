import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  getBroadcastAudienceOptions,
  previewBroadcastAudience,
} from "@/server/services/broadcast-audience.service";
import { broadcastAudiencePreviewSchema } from "@/server/validators/broadcast-draft.validator";

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

    const options = await getBroadcastAudienceOptions(
      context.membership.companyId,
    );

    return NextResponse.json({ options });
  } catch (error) {
    console.error("GET_BROADCAST_AUDIENCE_OPTIONS_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to fetch audience options" },
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

    const body = broadcastAudiencePreviewSchema.parse(await request.json());
    const preview = await previewBroadcastAudience({
      companyId: context.membership.companyId,
      filters: body.filters,
      groupIds: body.groupIds,
      requireMarketingConsent: body.requireMarketingConsent,
      segmentIds: body.segmentIds,
    });

    return NextResponse.json({ preview });
  } catch (error) {
    console.error("PREVIEW_BROADCAST_AUDIENCE_ERROR:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          errors: error.flatten().fieldErrors,
          message: "Invalid audience preview filters",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to preview audience",
      },
      { status: 500 },
    );
  }
}
