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
      razorpay: {
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: checkout.razorpayOrderId,
        amountPaise: checkout.amountPaise,
        currency: checkout.currency,
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
