import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import {
  CampaignLaunchOrchestratorError,
  getCampaignLaunchDashboard,
  prepareCampaignLaunch,
} from "@/server/services/campaign-launch-orchestrator.service";
import { UsageQuotaExceededError } from "@/server/services/usage-quota.service";
import { createUsageQuotaErrorResponse } from "@/server/utils/api-usage-quota-error";

const PrepareLaunchSchema = z.object({
  campaignId: z.string().min(1),
  idempotencyKey: z.string().optional().nullable(),
  segmentId: z.string().min(1),
  templateId: z.string().optional().nullable(),
  templateName: z.string().min(1),
  templateLanguage: z.string().optional().nullable(),
  templateBody: z.string().min(1),
  templateStatus: z.string().optional().nullable(),
  templateCategory: z.string().optional().nullable(),
  estimatedCostPaise: z.number().int().nonnegative().optional().nullable(),
});

export async function GET(request: Request) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const url = new URL(request.url);
  const dashboard = await getCampaignLaunchDashboard({
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
    const body = PrepareLaunchSchema.parse(await request.json());
    const launchRun = await prepareCampaignLaunch({
      companyId: workspace.membership.companyId,
      actorUserId: workspace.user.id,
      campaignId: body.campaignId,
      idempotencyKey:
        body.idempotencyKey ?? request.headers.get("Idempotency-Key"),
      segmentId: body.segmentId,
      templateId: body.templateId,
      templateName: body.templateName,
      templateLanguage: body.templateLanguage,
      templateBody: body.templateBody,
      templateStatus: body.templateStatus,
      templateCategory: body.templateCategory,
      estimatedCostPaise: body.estimatedCostPaise,
    });

    return NextResponse.json({ ok: true, launchRun });
  } catch (error) {
    if (error instanceof CampaignLaunchOrchestratorError) {
      return NextResponse.json(
        { ok: false, code: "CAMPAIGN_LAUNCH_ERROR", message: error.message },
        { status: 400 },
      );
    }

    if (error instanceof UsageQuotaExceededError) {
      return createUsageQuotaErrorResponse(error);
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "Invalid campaign launch details",
          errors: error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    throw error;
  }
}
