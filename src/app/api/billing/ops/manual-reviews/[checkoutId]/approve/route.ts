import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeBillingManualReview } from "@/server/auth/billing-ops-authorization";
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
  const authorization = await authorizeBillingManualReview(request);

  if (!authorization.ok) {
    return authorization.response;
  }

  const { checkoutId } = await context.params;

  try {
    const body = ApproveSchema.parse(await request.json());

    const result = await approveManualPlanCheckout({
      checkoutId,
      companyId: authorization.actor.companyId,
      reviewedByUserId: authorization.actor.userId,
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
