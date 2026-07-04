import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedWorkspace } from "@/server/auth/authorization";
import {
  CreditPurchaseError,
  verifyCreditPurchaseCheckout,
} from "@/server/services/credit-purchase.service";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";

const VerifyCreditPurchaseSchema = z.object({
  cashfreeOrderId: z.string().trim().min(1),
});

type RouteContext = {
  params: Promise<{
    purchaseId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  let workspace;

  try {
    workspace = await requireAuthenticatedWorkspace({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const { purchaseId } = await context.params;

  try {
    const body = VerifyCreditPurchaseSchema.parse(await request.json());
    const result = await verifyCreditPurchaseCheckout({
      companyId: workspace.membership.companyId,
      purchaseId,
      cashfreeOrderId: body.cashfreeOrderId,
    });

    return NextResponse.json({
      ok: true,
      result,
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
          message: "Invalid credit purchase verification details.",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    throw error;
  }
}
