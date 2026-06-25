import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import {
  listManualReviewCheckouts,
  listRecentPlanCheckouts,
} from "@/server/services/billing-ops.service";

export async function GET(request: Request) {
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

  const [manualReviews, recentCheckouts] = await Promise.all([
    listManualReviewCheckouts({
      companyId: workspace.membership.companyId,
    }),
    listRecentPlanCheckouts({
      companyId: workspace.membership.companyId,
      take: 25,
    }),
  ]);

  return NextResponse.json({
    ok: true,
    manualReviews,
    recentCheckouts,
  });
}
