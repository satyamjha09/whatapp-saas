import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { createCashfreeSubscriptionOrder } from "@/server/services/cashfree-subscription.service";
import {
  assertSystemWritesAllowed,
  SystemMaintenanceModeError,
} from "@/server/services/system-maintenance-mode.service";
import { createCashfreeSubscriptionOrderSchema } from "@/server/validators/cashfree-subscription.validator";
import { RATE_LIMIT_RULES } from "@/server/config/rate-limits";
import {
  enforceApiRateLimit,
  isRateLimitResponse,
} from "@/server/utils/api-rate-limit";
import {
  createRequestBodyErrorResponse,
  readRequestJsonWithLimit,
  REQUEST_BODY_LIMITS,
} from "@/server/utils/request-body-guard";

export async function POST(request: Request) {
  const rateLimit = await enforceApiRateLimit({
    request,
    rule: RATE_LIMIT_RULES.subscriptionOrderCreate,
  });

  if (isRateLimitResponse(rateLimit)) {
    return rateLimit;
  }

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

    let body: unknown;

    try {
      body = await readRequestJsonWithLimit({
        request,
        maxBytes: REQUEST_BODY_LIMITS.json(),
      });
    } catch (error) {
      return createRequestBodyErrorResponse({
        request,
        error,
        source: "subscription-cashfree-order-create",
      });
    }

    const validation = createCashfreeSubscriptionOrderSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { message: "Invalid subscription plan", errors: validation.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    await assertSystemWritesAllowed({
      operation: "Creating billing orders",
    });

    const result = await createCashfreeSubscriptionOrder({
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
        provider: "CASHFREE",
        plan: result.plan.id,
        amountPaise: result.plan.monthlyPricePaise,
        cashfreeOrderId: result.order.id,
      },
    });

    return NextResponse.json({
      message: "Subscription payment order created",
      result: {
        checkoutMode: result.checkoutMode,
        order: result.order,
        plan: result.plan,
      },
    });
  } catch (error) {
    console.error("CREATE_CASHFREE_SUBSCRIPTION_ORDER_ERROR:", error);
    if (error instanceof SystemMaintenanceModeError) {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "";

    if (["Invalid billing plan", "Free plan does not require payment", "Cashfree credentials are not configured"].includes(message)) {
      return NextResponse.json({ message }, { status: 400 });
    }
    return NextResponse.json({ message: "Unable to create subscription payment order" }, { status: 500 });
  }
}
