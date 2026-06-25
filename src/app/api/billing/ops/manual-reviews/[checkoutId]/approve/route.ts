import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import {
  approveManualPlanCheckout,
  BillingOpsError,
} from "@/server/services/billing-ops.service";

const ApproveSchema = z.object({
  confirmation: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

type RouteContext = {
  params: Promise<{
    checkoutId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
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

  const { checkoutId } = await context.params;

  try {
    const body = ApproveSchema.parse(await request.json());

    const result = await approveManualPlanCheckout({
      checkoutId,
      reviewedByUserId: workspace.user.id,
      confirmation: body.confirmation,
      notes: body.notes,
    });

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    if (error instanceof BillingOpsError) {
      return NextResponse.json(
        {
          ok: false,
          code: "BILLING_OPS_ERROR",
          message: error.message,
        },
        {
          status: 400,
        },
      );
    }

    throw error;
  }
}
