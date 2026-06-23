import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import { createAuditLog } from "@/server/services/audit.service";
import { ignoreDeadLetterJob } from "@/server/services/dead-letter-queue.service";

type RouteContext = {
  params: Promise<{ jobRecordId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const { jobRecordId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { reason?: string };

  try {
    await ignoreDeadLetterJob({
      jobRecordId,
      ignoredByUserId: workspace.user.id,
      reason: body.reason,
    });

    await createAuditLog({
      companyId: workspace.membership.companyId,
      actorUserId: workspace.user.id,
      action: "dead_letter_queue.job_ignored",
      entityType: "DeadLetterJob",
      entityId: jobRecordId,
      metadata: { reason: body.reason ?? null },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to ignore job";
    const status = message === "Dead letter job not found" ? 404 : 409;
    return NextResponse.json({ ok: false, message }, { status });
  }
}
