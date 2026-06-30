import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { verifyCashfreeSubscriptionPayment } from "@/server/services/cashfree-subscription.service";
import { verifyCashfreeSubscriptionPaymentSchema } from "@/server/validators/cashfree-subscription.validator";

export async function POST(request: Request) {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!context.membership) {
      return NextResponse.json({ message: "Complete company onboarding first" }, { status: 403 });
    }
    if (!["OWNER", "ADMIN"].includes(context.membership.role)) {
      return NextResponse.json(
        { message: "Only owners and admins can verify subscription payments" },
        { status: 403 },
      );
    }

    const validation = verifyCashfreeSubscriptionPaymentSchema.safeParse(
      await request.json(),
    );
    if (!validation.success) {
      return NextResponse.json(
        { message: "Invalid subscription payment verification payload", errors: validation.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const result = await verifyCashfreeSubscriptionPayment({
      companyId: context.membership.companyId,
      userId: context.user.id,
      input: validation.data,
    });
    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "billing.subscription_payment.verified",
      entityType: "SubscriptionPayment",
      entityId: result.payment.id,
      metadata: {
        provider: "CASHFREE",
        plan: result.payment.plan,
        amountPaise: result.payment.amountPaise,
        cashfreeOrderId: result.payment.cashfreeOrderId,
        cashfreePaymentId: result.payment.cashfreePaymentId,
        alreadyPaid: result.alreadyPaid,
      },
    });

    return NextResponse.json({
      message: "Subscription payment verified",
      result: {
        paymentId: result.payment.id,
        plan: result.payment.plan,
        alreadyPaid: result.alreadyPaid,
      },
    });
  } catch (error) {
    console.error("VERIFY_CASHFREE_SUBSCRIPTION_PAYMENT_ERROR:", error);
    const message = error instanceof Error ? error.message : "";

    if (["Cashfree payment not successful", "Subscription payment not found", "Cashfree credentials are not configured"].includes(message)) {
      return NextResponse.json({ message }, { status: 400 });
    }
    return NextResponse.json({ message: "Unable to verify subscription payment" }, { status: 500 });
  }
}
