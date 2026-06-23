import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import { createAuditLog } from "@/server/services/audit.service";
import { syncAllFailedQueueJobs } from "@/server/services/dead-letter-queue.service";

export async function POST(request: Request) {
  let context;

  try {
    context = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  try {
    const results = await syncAllFailedQueueJobs();

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "dead_letter_queue.synced",
      entityType: "DeadLetterJob",
      metadata: { results },
    });

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to sync failed jobs",
      },
      { status: 500 },
    );
  }
}
