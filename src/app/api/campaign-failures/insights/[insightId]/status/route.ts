import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import {
  CampaignFailureIntelligenceError,
  updateCampaignFailureInsightStatus,
} from "@/server/services/campaign-failure-intelligence.service";

const StatusSchema = z.object({
  status: z.enum(["FIXED", "IGNORED"]),
  ignoreReason: z.string().max(1000).optional().nullable(),
});

type RouteContext = {
  params: Promise<{ insightId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const { insightId } = await context.params;

  try {
    const body = StatusSchema.parse(await request.json());
    const insight = await updateCampaignFailureInsightStatus({
      companyId: workspace.membership.companyId,
      insightId,
      actorUserId: workspace.user.id,
      status: body.status,
      ignoreReason: body.ignoreReason,
    });

    return NextResponse.json({ ok: true, insight });
  } catch (error) {
    if (error instanceof CampaignFailureIntelligenceError) {
      return NextResponse.json(
        {
          ok: false,
          code: "CAMPAIGN_FAILURE_INTELLIGENCE_ERROR",
          message: error.message,
        },
        { status: 400 },
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "Invalid failure insight status",
          errors: error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    throw error;
  }
}
