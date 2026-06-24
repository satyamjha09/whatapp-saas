import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/authorization";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import {
  cancelScheduledPlanChange,
  ScheduledPlanChangeError,
} from "@/server/services/scheduled-plan-change.service";
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

    const result = await cancelScheduledPlanChange({
      companyId: workspace.membership.companyId,
      requestedByUserId: workspace.user.id,
    });

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    if (error instanceof ScheduledPlanChangeError) {
      return NextResponse.json(
        {
          ok: false,
          code: "SCHEDULED_PLAN_CHANGE_ERROR",
          message: error.message,
        },
        {
          status: 400,
        },
      );
    }

    return createRoutePermissionErrorResponse(error);
  }
}
