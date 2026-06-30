import { NextResponse } from "next/server";
import { z } from "zod";
import { BillingPlan } from "@/generated/prisma/client";
import { requireAdmin } from "@/server/auth/authorization";
import {
  createPlanCheckout,
  getPlanUpgradeRedirects,
  PlanUpgradeError,
} from "@/server/services/plan-upgrade.service";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";

const CreateCheckoutSchema = z.object({
  toPlan: z.enum(BillingPlan),
});

function getPaymentSessionId(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const cashfreeOrder = (metadata as Record<string, unknown>).cashfreeOrder;

  if (
    !cashfreeOrder ||
    typeof cashfreeOrder !== "object" ||
    Array.isArray(cashfreeOrder)
  ) {
    return null;
  }

  const paymentSessionId = (cashfreeOrder as Record<string, unknown>)
    .payment_session_id;

  return typeof paymentSessionId === "string" ? paymentSessionId : null;
}

export async function POST(request: Request) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  try {
    const body = CreateCheckoutSchema.parse(await request.json());

    const checkout = await createPlanCheckout({
      companyId: workspace.membership.companyId,
      requestedByUserId: workspace.user.id,
      toPlan: body.toPlan,
    });

    return NextResponse.json({
      ok: true,
      checkout,
      cashfree: {
        checkoutMode: process.env.CASHFREE_ENV === "sandbox" ? "sandbox" : "production",
        orderId: checkout.cashfreeOrderId,
        amountPaise: checkout.amountPaise,
        currency: checkout.currency,
        paymentSessionId: getPaymentSessionId(checkout.metadata),
      },
      redirects: getPlanUpgradeRedirects(),
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
