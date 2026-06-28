import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/authorization";
import {
  CampaignThroughputGuardError,
  updateCampaignThroughputPolicy,
} from "@/server/services/campaign-throughput-guard.service";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";

const UpdatePolicySchema = z.object({
  maxPerHour: z.number().int().positive().optional().nullable(),
  maxPerMinute: z.number().int().positive().optional().nullable(),
  minDelayMs: z.number().int().nonnegative().optional().nullable(),
  mode: z.enum(["NORMAL", "SLOW", "PAUSED"]).optional(),
});

type RouteContext = {
  params: Promise<{ campaignId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const { campaignId } = await context.params;

  try {
    const body = UpdatePolicySchema.parse(await request.json());
    const policy = await updateCampaignThroughputPolicy({
      actorUserId: workspace.user.id,
      campaignId,
      companyId: workspace.membership.companyId,
      maxPerHour: body.maxPerHour,
      maxPerMinute: body.maxPerMinute,
      minDelayMs: body.minDelayMs,
      mode: body.mode,
    });

    return NextResponse.json({ ok: true, policy });
  } catch (error) {
    if (error instanceof CampaignThroughputGuardError) {
      return NextResponse.json(
        {
          ok: false,
          code: "CAMPAIGN_THROUGHPUT_ERROR",
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
          message: "Invalid campaign throughput policy update",
        },
        { status: 400 },
      );
    }

    throw error;
  }
}
