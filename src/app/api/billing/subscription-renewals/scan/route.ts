import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/authorization";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import { createAuditLog } from "@/server/services/audit.service";
import { scanSubscriptionRenewals } from "@/server/services/subscription-renewal.service";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";

export async function POST(request: Request) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  try {
    await assertRoutePermission({
      request,
      workspace,
      permission: "BILLING_MANAGE",
    });
  } catch (error) {
    return createRoutePermissionErrorResponse(error);
  }

  const result = await scanSubscriptionRenewals();

  await createAuditLog({
    companyId: workspace.membership.companyId,
    actorUserId: workspace.user.id,
    action: "billing.subscription_renewals_scanned",
    entityType: "Company",
    entityId: workspace.membership.companyId,
    metadata: result,
  });

  return NextResponse.json({
    ok: true,
    result,
  });
}
