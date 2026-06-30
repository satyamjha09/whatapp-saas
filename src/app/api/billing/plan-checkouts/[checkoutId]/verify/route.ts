import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedWorkspace } from "@/server/auth/authorization";
import {
  completePlanCheckout,
  PlanUpgradeError,
} from "@/server/services/plan-upgrade.service";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";

const VerifyCheckoutSchema = z.object({
  cashfreeOrderId: z.string().min(1),
});

type RouteContext = {
  params: Promise<{
    checkoutId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  let workspace;

  try {
    workspace = await requireAuthenticatedWorkspace({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const { checkoutId } = await context.params;

  try {
    const body = VerifyCheckoutSchema.parse(await request.json());

    const result = await completePlanCheckout({
      companyId: workspace.membership.companyId,
      checkoutId,
      actorUserId: workspace.user.id,
      cashfreeOrderId: body.cashfreeOrderId,
    });

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    if (error instanceof PlanUpgradeError) {
      return NextResponse.json(
        {
          ok: false,
          code: "PLAN_UPGRADE_ERROR",
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
