import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import {
  analyzeCampaignFailures,
  CampaignFailureIntelligenceError,
  getCampaignFailureDashboard,
} from "@/server/services/campaign-failure-intelligence.service";

const AnalyzeSchema = z.object({
  campaignId: z.string().min(1),
});

export async function GET(request: Request) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const url = new URL(request.url);
  const dashboard = await getCampaignFailureDashboard({
    companyId: workspace.membership.companyId,
    campaignId: url.searchParams.get("campaignId"),
  });

  return NextResponse.json({ ok: true, ...dashboard });
}

export async function POST(request: Request) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  try {
    const body = AnalyzeSchema.parse(await request.json());
    const dashboard = await analyzeCampaignFailures({
      companyId: workspace.membership.companyId,
      campaignId: body.campaignId,
      actorUserId: workspace.user.id,
    });

    return NextResponse.json({ ok: true, ...dashboard });
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
          message: "Invalid campaign failure request",
          errors: error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    throw error;
  }
}
