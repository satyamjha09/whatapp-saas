import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import { createAuditLog } from "@/server/services/audit.service";
import { retryDeadLetterJob } from "@/server/services/dead-letter-queue.service";

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

  try {
    const result = await retryDeadLetterJob({
      jobRecordId,
      retriedByUserId: workspace.user.id,
    });

    await createAuditLog({
      companyId: workspace.membership.companyId,
      actorUserId: workspace.user.id,
      action: "dead_letter_queue.job_retried",
      entityType: "DeadLetterJob",
      entityId: jobRecordId,
      metadata: result,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retry job";
    const status = message === "Dead letter job not found" ? 404 : 409;
    return NextResponse.json({ ok: false, message }, { status });
  }
}
