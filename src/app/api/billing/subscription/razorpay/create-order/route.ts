import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { createRazorpaySubscriptionOrder } from "@/server/services/razorpay-subscription.service";
import { createRazorpaySubscriptionOrderSchema } from "@/server/validators/razorpay-subscription.validator";

export async function POST(request: Request) {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!context.membership) {
      return NextResponse.json({ message: "Complete company onboarding first" }, { status: 403 });
    }
    if (!["OWNER", "ADMIN"].includes(context.membership.role)) {
      return NextResponse.json(
        { message: "Only owners and admins can change subscription plans" },
        { status: 403 },
      );
    }

    const validation = createRazorpaySubscriptionOrderSchema.safeParse(
      await request.json(),
    );
    if (!validation.success) {
      return NextResponse.json(
        { message: "Invalid subscription plan", errors: validation.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const result = await createRazorpaySubscriptionOrder({
      companyId: context.membership.companyId,
      userId: context.user.id,
      input: validation.data,
    });
    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "billing.subscription_order.created",
      entityType: "SubscriptionPayment",
      entityId: result.payment.id,
      metadata: {
        plan: result.plan.id,
        amountPaise: result.plan.monthlyPricePaise,
        razorpayOrderId: result.order.id,
      },
    });

    return NextResponse.json({
      message: "Subscription payment order created",
      result: {
        keyId: result.keyId,
        order: result.order,
        plan: result.plan,
      },
    });
  } catch (error) {
    console.error("CREATE_SUBSCRIPTION_ORDER_ERROR:", error);
    const message = error instanceof Error ? error.message : "";

    if (["Invalid billing plan", "Free plan does not require payment", "Razorpay credentials are not configured"].includes(message)) {
      return NextResponse.json({ message }, { status: 400 });
    }
    return NextResponse.json({ message: "Unable to create subscription payment order" }, { status: 500 });
  }
}
