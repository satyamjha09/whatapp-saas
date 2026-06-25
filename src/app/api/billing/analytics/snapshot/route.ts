import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import { generateCurrentBillingSnapshots } from "@/server/services/billing-analytics.service";
import { createAuditLog } from "@/server/services/audit.service";

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

  const result = await generateCurrentBillingSnapshots();

  await createAuditLog({
    companyId: workspace.membership.companyId,
    actorUserId: workspace.user.id,
    action: "billing.analytics_snapshot_generated",
    entityType: "Company",
    entityId: workspace.membership.companyId,
    metadata: {
      generated: true,
    },
  });

  return NextResponse.json({
    ok: true,
    result,
  });
}
