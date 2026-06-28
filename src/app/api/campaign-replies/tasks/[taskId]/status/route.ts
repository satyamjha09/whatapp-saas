import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/authorization";
import {
  CampaignReplyAttributionError,
  updateCampaignFollowUpTask,
} from "@/server/services/campaign-reply-attribution.service";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";

const StatusSchema = z.object({
  ignoreReason: z.string().max(1000).optional().nullable(),
  status: z.enum(["COMPLETED", "IGNORED"]),
});

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const { taskId } = await context.params;

  try {
    const body = StatusSchema.parse(await request.json());
    const task = await updateCampaignFollowUpTask({
      actorUserId: workspace.user.id,
      companyId: workspace.membership.companyId,
      ignoreReason: body.ignoreReason,
      status: body.status,
      taskId,
    });

    return NextResponse.json({ ok: true, task });
  } catch (error) {
    if (error instanceof CampaignReplyAttributionError) {
      return NextResponse.json(
        {
          ok: false,
          code: "CAMPAIGN_FOLLOW_UP_TASK_ERROR",
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
          message: "Invalid follow-up task status",
        },
        { status: 400 },
      );
    }

    throw error;
  }
}
