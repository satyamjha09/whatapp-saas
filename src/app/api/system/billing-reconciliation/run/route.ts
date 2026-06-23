import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import { runBillingReconciliation } from "@/server/services/billing-reconciliation.service";
import { createAuditLog } from "@/server/services/audit.service";

export async function POST(request: Request) {
  let context;

  try {
    context = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  try {
    const result = await runBillingReconciliation();
    const metadata =
      "id" in result
        ? {
            runId: result.id,
            status: result.status,
            checkedCompanies: result.checkedCompanies,
            checkedLedgers: result.checkedLedgers,
            issueCount: result.issueCount,
          }
        : { skipped: result.skipped, reason: result.reason };

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "billing_reconciliation.run",
      entityType: "BillingReconciliationRun",
      entityId: "id" in result ? result.id : undefined,
      metadata,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to run billing reconciliation",
      },
      { status: 500 },
    );
  }
}
