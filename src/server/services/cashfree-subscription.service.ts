import { prisma } from "@/lib/prisma";
import { getBillingPlanConfig } from "@/server/config/billing-plans";
import {
  createCashfreeOrder,
  getCashfreeCheckoutMode,
  getPaidCashfreePaymentForOrder,
} from "@/server/services/cashfree-payment.service";
import { addOneMonth } from "@/server/services/subscription.service";
import type {
  CreateCashfreeSubscriptionOrderInput,
  VerifyCashfreeSubscriptionPaymentInput,
} from "@/server/validators/cashfree-subscription.validator";

function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function getNextBillingPeriod(currentPeriodEnd?: Date | null) {
  const now = new Date();
  const periodStart =
    currentPeriodEnd && currentPeriodEnd > now ? currentPeriodEnd : now;

  return { periodStart, periodEnd: addOneMonth(periodStart) };
}

export async function createCashfreeSubscriptionOrder({
  companyId,
  userId,
  input,
}: {
  companyId: string;
  userId: string;
  input: CreateCashfreeSubscriptionOrderInput;
}) {
  const plan = getBillingPlanConfig(input.plan);

  if (plan.id === "FREE") throw new Error("Free plan does not require payment");

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { billingPlan: true, currentPeriodEnd: true, name: true },
  });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, mobile: true, name: true },
  });

  if (!company) throw new Error("Company not found");
  if (!user) throw new Error("User not found");

  const isSamePlanRenewal = company.billingPlan === plan.id;
  const { periodStart, periodEnd } = getNextBillingPeriod(
    isSamePlanRenewal ? company.currentPeriodEnd : null,
  );
  const payment = await prisma.subscriptionPayment.create({
    data: {
      companyId,
      userId,
      plan: plan.id,
      amountPaise: plan.monthlyPricePaise,
      currency: "INR",
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      cashfreeOrderId: `sub_${Date.now().toString(36)}`,
    },
  });
  const order = await createCashfreeOrder({
    orderId: payment.id,
    amountPaise: plan.monthlyPricePaise,
    currency: "INR",
    customer: {
      id: userId,
      email: user.email,
      name: user.name,
      phone: user.mobile,
    },
    returnUrl: `${getAppUrl()}/dashboard/billing/subscription?cashfree_order_id={order_id}`,
    notifyUrl: `${getAppUrl()}/api/webhooks/cashfree`,
    tags: {
      type: "SUBSCRIPTION_PLAN",
      companyId,
      userId,
      plan: plan.id,
    },
  });
  const updatedPayment = await prisma.subscriptionPayment.update({
    where: { id: payment.id },
    data: {
      cashfreeOrderId: order.order_id!,
    },
  });

  return {
    checkoutMode: getCashfreeCheckoutMode(),
    payment: updatedPayment,
    order: {
      id: order.order_id!,
      amount: plan.monthlyPricePaise,
      currency: "INR",
      status: order.order_status ?? "ACTIVE",
      paymentSessionId: order.payment_session_id!,
    },
    plan,
  };
}

async function activateSubscriptionPayment({
  amountPaise,
  currency,
  cashfreeOrderId,
  cashfreePaymentId,
}: {
  amountPaise?: number;
  currency?: string;
  cashfreeOrderId: string;
  cashfreePaymentId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.subscriptionPayment.findUnique({
      where: { cashfreeOrderId: cashfreeOrderId },
    });

    if (!payment) throw new Error("Subscription payment not found");
    if (amountPaise !== undefined && amountPaise !== payment.amountPaise) {
      throw new Error("Cashfree payment amount mismatch");
    }
    if (currency && currency.toUpperCase() !== payment.currency.toUpperCase()) {
      throw new Error("Cashfree payment currency mismatch");
    }
    if (payment.status === "PAID") {
      return { alreadyPaid: true, payment, company: null, plan: getBillingPlanConfig(payment.plan) };
    }

    const claimed = await tx.subscriptionPayment.updateMany({
      where: { id: payment.id, status: { not: "PAID" } },
      data: {
        status: "PAID",
        cashfreePaymentId: cashfreePaymentId,
        paidAt: new Date(),
        failedAt: null,
        failureReason: null,
      },
    });

    if (claimed.count === 0) {
      const paidPayment = await tx.subscriptionPayment.findUniqueOrThrow({
        where: { id: payment.id },
      });
      return { alreadyPaid: true, payment: paidPayment, company: null, plan: getBillingPlanConfig(payment.plan) };
    }

    const plan = getBillingPlanConfig(payment.plan);
    const now = new Date();
    const company = await tx.company.update({
      where: { id: payment.companyId },
      data: {
        billingPlan: plan.id,
        subscriptionStatus: "ACTIVE",
        monthlyMessageLimit: plan.monthlyMessageLimit,
        currentPeriodStart: payment.billingPeriodStart ?? now,
        currentPeriodEnd: payment.billingPeriodEnd ?? addOneMonth(now),
        cancelAtPeriodEnd: false,
        subscriptionCanceledAt: null,
      },
    });
    const paidPayment = await tx.subscriptionPayment.findUniqueOrThrow({
      where: { id: payment.id },
    });

    return { alreadyPaid: false, payment: paidPayment, company, plan };
  });
}

export async function verifyCashfreeSubscriptionPayment({
  companyId,
  input,
}: {
  companyId: string;
  userId: string;
  input: VerifyCashfreeSubscriptionPaymentInput;
}) {
  const payment = await prisma.subscriptionPayment.findFirst({
    where: { companyId, cashfreeOrderId: input.cashfreeOrderId },
  });

  if (!payment) throw new Error("Subscription payment not found");

  const cashfreePayment = await getPaidCashfreePaymentForOrder(
    input.cashfreeOrderId,
  );

  if (!cashfreePayment.isPaid || !cashfreePayment.payment?.cf_payment_id) {
    await prisma.subscriptionPayment.updateMany({
      where: { id: payment.id, status: { not: "PAID" } },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        failureReason: "Cashfree payment not successful",
      },
    });
    throw new Error("Cashfree payment not successful");
  }

  return activateSubscriptionPayment({
    cashfreeOrderId: input.cashfreeOrderId,
    cashfreePaymentId: String(cashfreePayment.payment.cf_payment_id),
    amountPaise:
      cashfreePayment.payment.payment_amount !== undefined
        ? Math.round(cashfreePayment.payment.payment_amount * 100)
        : undefined,
    currency: cashfreePayment.payment.payment_currency,
  });
}

export async function markCashfreeSubscriptionPaymentPaidFromWebhook(input: {
  amountPaise?: number;
  currency?: string;
  cashfreeOrderId: string;
  cashfreePaymentId: string;
}) {
  return activateSubscriptionPayment(input);
}

export async function markCashfreeSubscriptionPaymentFailedFromWebhook({
  failureReason,
  cashfreeOrderId,
  cashfreePaymentId,
}: {
  failureReason?: string;
  cashfreeOrderId: string;
  cashfreePaymentId?: string;
}) {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { cashfreeOrderId: cashfreeOrderId },
  });

  if (!payment) throw new Error("Subscription payment not found");
  await prisma.subscriptionPayment.updateMany({
    where: { id: payment.id, status: { not: "PAID" } },
    data: {
      status: "FAILED",
      cashfreePaymentId: cashfreePaymentId ?? payment.cashfreePaymentId,
      failedAt: new Date(),
      failureReason: failureReason ?? "Cashfree payment failed",
    },
  });

  return prisma.subscriptionPayment.findUniqueOrThrow({ where: { id: payment.id } });
}

export async function changeWorkspaceToFreePlan(companyId: string) {
  const plan = getBillingPlanConfig("FREE");
  const now = new Date();
  const company = await prisma.company.update({
    where: { id: companyId },
    data: {
      billingPlan: plan.id,
      subscriptionStatus: "TRIALING",
      monthlyMessageLimit: plan.monthlyMessageLimit,
      currentPeriodStart: now,
      currentPeriodEnd: addOneMonth(now),
      cancelAtPeriodEnd: false,
      subscriptionCanceledAt: null,
    },
  });

  return { company, plan };
}
