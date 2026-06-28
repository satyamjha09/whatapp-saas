import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/authorization";
import {
  CampaignCompletionReportError,
  generateCampaignCompletionReport,
  getCampaignCompletionReportDashboard,
} from "@/server/services/campaign-completion-report.service";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";

const GenerateSchema = z.object({
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
  const dashboard = await getCampaignCompletionReportDashboard({
    campaignId: url.searchParams.get("campaignId"),
    companyId: workspace.membership.companyId,
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
    const body = GenerateSchema.parse(await request.json());
    const report = await generateCampaignCompletionReport({
      actorUserId: workspace.user.id,
      campaignId: body.campaignId,
      companyId: workspace.membership.companyId,
      trigger: "MANUAL",
    });

    return NextResponse.json({ ok: true, report });
  } catch (error) {
    if (error instanceof CampaignCompletionReportError) {
      return NextResponse.json(
        {
          ok: false,
          code: "CAMPAIGN_REPORT_ERROR",
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
          errors: error.flatten().fieldErrors,
          message: "Invalid campaign report request",
        },
        { status: 400 },
      );
    }

    throw error;
  }
}
