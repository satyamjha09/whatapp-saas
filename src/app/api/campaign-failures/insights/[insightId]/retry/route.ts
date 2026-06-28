import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import {
  CampaignFailureIntelligenceError,
  retryCampaignFailureInsight,
} from "@/server/services/campaign-failure-intelligence.service";

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
    const result = await retryCampaignFailureInsight({
      companyId: workspace.membership.companyId,
      insightId,
      actorUserId: workspace.user.id,
    });

    return NextResponse.json({ ok: true, result });
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

    throw error;
  }
}
