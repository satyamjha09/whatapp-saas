import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { verifyRazorpaySubscriptionPayment } from "@/server/services/razorpay-subscription.service";
import { verifyRazorpaySubscriptionPaymentSchema } from "@/server/validators/razorpay-subscription.validator";

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

    const validation = verifyRazorpaySubscriptionPaymentSchema.safeParse(
      await request.json(),
    );
    if (!validation.success) {
      return NextResponse.json(
        { message: "Invalid subscription payment verification payload", errors: validation.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const result = await verifyRazorpaySubscriptionPayment({
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
        plan: result.payment.plan,
        amountPaise: result.payment.amountPaise,
        razorpayOrderId: result.payment.razorpayOrderId,
        razorpayPaymentId: result.payment.razorpayPaymentId,
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
    console.error("VERIFY_SUBSCRIPTION_PAYMENT_ERROR:", error);
    const message = error instanceof Error ? error.message : "";

    if (["Invalid Razorpay signature", "Subscription payment not found", "Razorpay credentials are not configured"].includes(message)) {
      return NextResponse.json({ message }, { status: 400 });
    }
    return NextResponse.json({ message: "Unable to verify subscription payment" }, { status: 500 });
  }
}
