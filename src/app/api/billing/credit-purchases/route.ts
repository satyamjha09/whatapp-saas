import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/authorization";
import {
  createCreditPurchaseCheckout,
  CreditPurchaseError,
  getCreditPacks,
} from "@/server/services/credit-purchase.service";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";

const CreateCreditPurchaseSchema = z.object({
  packId: z.string().trim().min(1),
});

export async function GET(request: Request) {
  try {
    await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  return NextResponse.json({
    ok: true,
    packs: getCreditPacks(),
  });
}

export async function POST(request: Request) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  try {
    const body = CreateCreditPurchaseSchema.parse(await request.json());
    const checkout = await createCreditPurchaseCheckout({
      companyId: workspace.membership.companyId,
      userId: workspace.user.id,
      packId: body.packId,
    });

    return NextResponse.json({
      ok: true,
      purchase: checkout.purchase,
      pack: checkout.pack,
      cashfree: {
        checkoutMode: checkout.checkoutMode,
        orderId: checkout.purchase.cashfreeOrderId,
        amountPaise: checkout.purchase.amountPaise,
        currency: checkout.purchase.currency,
        paymentSessionId: checkout.order.payment_session_id,
      },
    });
  } catch (error) {
    if (error instanceof CreditPurchaseError) {
      return NextResponse.json(
        {
          ok: false,
          code: "CREDIT_PURCHASE_ERROR",
          message: error.message,
        },
        { status: 400 },
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "Invalid credit purchase details.",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    throw error;
  }
}
