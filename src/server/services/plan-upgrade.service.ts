import { BillingPlan, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getBillingPlanConfig } from "@/server/config/billing-plans";
import { createAuditLog } from "@/server/services/audit.service";
import { createPaidPlanUpgradeInvoice } from "@/server/services/billing-invoice.service";
import {
  createCashfreeOrder,
  getPaidCashfreePaymentForOrder,
} from "@/server/services/cashfree-payment.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";

export class PlanUpgradeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanUpgradeError";
  }
}

function isEnabled() {
  return process.env.PLAN_UPGRADES_ENABLED !== "false";
}

function currency() {
  return process.env.PLAN_UPGRADE_CURRENCY || "INR";
}

function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function getPlanUpgradeRedirects() {
  return {
    success:
      process.env.PLAN_UPGRADE_SUCCESS_REDIRECT || "/dashboard/billing",
    cancel:
      process.env.PLAN_UPGRADE_CANCEL_REDIRECT ||
      "/dashboard/billing/usage-quotas",
  };
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

function numericEnv(key: string, fallback: number) {
  const value = Number(process.env[key] ?? fallback);

  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function getPlanPricePaise(plan: BillingPlan) {
  if (plan === "STARTER") {
    return numericEnv(
      "PLAN_PRICE_STARTER_PAISE",
      getBillingPlanConfig("STARTER").monthlyPricePaise,
    );
  }

  if (plan === "GROWTH") {
    return numericEnv(
      "PLAN_PRICE_GROWTH_PAISE",
      getBillingPlanConfig("GROWTH").monthlyPricePaise,
    );
  }

  if (plan === "BUSINESS") {
    return numericEnv(
      "PLAN_PRICE_BUSINESS_PAISE",
      getBillingPlanConfig("BUSINESS").monthlyPricePaise,
    );
  }

  return 0;
}

export function getPlanMonthlyMessageLimit(plan: BillingPlan) {
  if (plan === "STARTER") {
    return numericEnv(
      "PLAN_LIMIT_STARTER_MESSAGES",
      getBillingPlanConfig("STARTER").monthlyMessageLimit,
    );
  }

  if (plan === "GROWTH") {
    return numericEnv(
      "PLAN_LIMIT_GROWTH_MESSAGES",
      getBillingPlanConfig("GROWTH").monthlyMessageLimit,
    );
  }

  if (plan === "BUSINESS") {
    return numericEnv(
      "PLAN_LIMIT_BUSINESS_MESSAGES",
      getBillingPlanConfig("BUSINESS").monthlyMessageLimit,
    );
  }

  return numericEnv(
    "FEATURE_ENTITLEMENTS_FREE_MONTHLY_MESSAGES",
    getBillingPlanConfig("FREE").monthlyMessageLimit,
  );
}

function assertUpgradeablePlan(plan: BillingPlan) {
  if (plan === "FREE") {
    throw new PlanUpgradeError("FREE does not need checkout.");
  }
}

function checkoutExpiryDate() {
  const minutes = Number(process.env.PLAN_CHECKOUT_EXPIRY_MINUTES ?? 60);
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 60;

  return new Date(Date.now() + safeMinutes * 60 * 1000);
}

export async function createPlanCheckout({
  companyId,
  requestedByUserId,
  toPlan,
}: {
  companyId: string;
  requestedByUserId?: string | null;
  toPlan: BillingPlan;
}) {
  if (!isEnabled()) {
    throw new PlanUpgradeError("Plan upgrades are disabled.");
  }

  assertUpgradeablePlan(toPlan);

  const company = await prisma.company.findUnique({
    where: {
      id: companyId,
    },
    select: {
      id: true,
      name: true,
      billingPlan: true,
    },
  });
  const requester = requestedByUserId
    ? await prisma.user.findUnique({
        where: {
          id: requestedByUserId,
        },
        select: {
          email: true,
          mobile: true,
          name: true,
        },
      })
    : null;

  if (!company) {
    throw new PlanUpgradeError("Company not found.");
  }

  if (company.billingPlan === toPlan) {
    throw new PlanUpgradeError(`Company is already on ${toPlan}.`);
  }

  const amountPaise = getPlanPricePaise(toPlan);

  if (!amountPaise || amountPaise <= 0) {
    throw new PlanUpgradeError(`Invalid price configured for ${toPlan}.`);
  }

  const checkout = await prisma.planCheckout.create({
    data: {
      companyId,
      requestedByUserId: requestedByUserId ?? null,
      fromPlan: company.billingPlan,
      toPlan,
      amountPaise,
      currency: currency(),
      expiresAt: checkoutExpiryDate(),
      metadata: safeJson({
        companyName: company.name,
      }),
    },
  });

  const order = await createCashfreeOrder({
    amountPaise,
    currency: currency(),
    orderId: checkout.id,
    customer: {
      id: requestedByUserId ?? companyId,
      email: requester?.email,
      name: requester?.name ?? company.name,
      phone: requester?.mobile,
    },
    returnUrl: `${getAppUrl()}${getPlanUpgradeRedirects().success}?cashfree_order_id={order_id}`,
    notifyUrl: `${getAppUrl()}/api/webhooks/cashfree`,
    tags: {
      companyId,
      checkoutId: checkout.id,
      fromPlan: company.billingPlan,
      toPlan,
    },
  });

  return prisma.planCheckout.update({
    where: {
      id: checkout.id,
    },
    data: {
      cashfreeOrderId: order.order_id,
      metadata: safeJson({
        companyName: company.name,
        cashfreeOrder: order,
      }),
    },
  });
}

export async function completePlanCheckout({
  companyId,
  checkoutId,
  actorUserId,
  cashfreeOrderId,
  cashfreePaymentId,
  amountPaise,
  currency: paymentCurrency,
}: {
  companyId: string;
  checkoutId: string;
  actorUserId?: string | null;
  cashfreeOrderId: string;
  cashfreePaymentId?: string | null;
  amountPaise?: number;
  currency?: string | null;
}) {
  const checkout = await prisma.planCheckout.findFirst({
    where: {
      id: checkoutId,
      companyId,
    },
    include: {
      company: true,
    },
  });

  if (!checkout) {
    throw new PlanUpgradeError("Checkout not found.");
  }

  if (checkout.status === "PAID") {
    return {
      checkout,
      planChange: await prisma.companyPlanChange.findFirst({
        where: {
          companyId,
          checkoutId: checkout.id,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      alreadyCompleted: true,
    };
  }

  if (checkout.status !== "CREATED") {
    throw new PlanUpgradeError(`Checkout is ${checkout.status}.`);
  }

  if (checkout.expiresAt && checkout.expiresAt < new Date()) {
    await prisma.planCheckout.update({
      where: {
        id: checkout.id,
      },
      data: {
        status: "EXPIRED",
        failedAt: new Date(),
        failureReason: "Checkout expired before verification",
      },
    });

    throw new PlanUpgradeError("Checkout expired.");
  }

  if (checkout.cashfreeOrderId !== cashfreeOrderId) {
    throw new PlanUpgradeError("Cashfree order mismatch.");
  }

  let verifiedPaymentId = cashfreePaymentId ?? null;
  let verifiedAmountPaise = amountPaise;
  let verifiedCurrency = paymentCurrency ?? null;

  if (!verifiedPaymentId) {
    const cashfreePayment = await getPaidCashfreePaymentForOrder(cashfreeOrderId);

    if (cashfreePayment.payment?.cf_payment_id) {
      verifiedPaymentId = String(cashfreePayment.payment.cf_payment_id);
      verifiedAmountPaise =
        cashfreePayment.payment.payment_amount !== undefined
          ? Math.round(cashfreePayment.payment.payment_amount * 100)
          : verifiedAmountPaise;
      verifiedCurrency = cashfreePayment.payment.payment_currency ?? verifiedCurrency;
    }
  }

  if (!verifiedPaymentId) {
    await prisma.planCheckout.update({
      where: {
        id: checkout.id,
      },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        failureReason: "Cashfree payment not successful",
      },
    });

    throw new PlanUpgradeError("Cashfree payment not successful.");
  }

  if (verifiedAmountPaise !== undefined && verifiedAmountPaise !== checkout.amountPaise) {
    throw new PlanUpgradeError("Cashfree payment amount mismatch.");
  }
  if (
    verifiedCurrency &&
    verifiedCurrency.toUpperCase() !== checkout.currency.toUpperCase()
  ) {
    throw new PlanUpgradeError("Cashfree payment currency mismatch.");
  }

  const newMonthlyMessageLimit = getPlanMonthlyMessageLimit(checkout.toPlan);

  const result = await prisma.$transaction(async (tx) => {
    const updatedCheckout = await tx.planCheckout.update({
      where: {
        id: checkout.id,
      },
      data: {
        status: "PAID",
        cashfreeOrderId: cashfreeOrderId,
        cashfreePaymentId: verifiedPaymentId,
        paidAt: new Date(),
      },
    });

    const previousMonthlyMessageLimit = checkout.company.monthlyMessageLimit;
    const now = new Date();

    await tx.company.update({
      where: {
        id: companyId,
      },
      data: {
        billingPlan: checkout.toPlan,
        subscriptionStatus: "ACTIVE",
        monthlyMessageLimit: newMonthlyMessageLimit,
        currentPeriodStart: now,
        currentPeriodEnd: addDays(now, 30),
        cancelAtPeriodEnd: false,
        subscriptionCanceledAt: null,
      },
    });

    const planChange = await tx.companyPlanChange.create({
      data: {
        companyId,
        actorUserId: actorUserId ?? null,
        fromPlan: checkout.fromPlan,
        toPlan: checkout.toPlan,
        source: "CHECKOUT",
        checkoutId: checkout.id,
        previousMonthlyMessageLimit,
        newMonthlyMessageLimit,
        reason: "self-serve-plan-upgrade",
        metadata: safeJson({
          provider: "CASHFREE",
          cashfreeOrderId,
          cashfreePaymentId: verifiedPaymentId,
        }),
      },
    });

    return {
      checkout: updatedCheckout,
      planChange,
    };
  });

  await createAuditLog({
    companyId,
    actorUserId: actorUserId ?? undefined,
    action: "billing.plan_upgraded",
    entityType: "Company",
    entityId: companyId,
    metadata: {
      checkoutId,
      fromPlan: checkout.fromPlan,
      toPlan: checkout.toPlan,
      provider: "CASHFREE",
      cashfreeOrderId,
      cashfreePaymentId: verifiedPaymentId,
    },
  }).catch(() => undefined);

  await createPaidPlanUpgradeInvoice({
    companyId,
    userId: actorUserId ?? null,
    planCheckoutId: checkout.id,
    planChangeId: result.planChange.id,
    toPlan: checkout.toPlan,
    amountPaise: checkout.amountPaise,
    currency: checkout.currency,
    cashfreeOrderId: cashfreeOrderId,
    cashfreePaymentId: verifiedPaymentId,
  }).catch(() => undefined);

  return result;
}

export async function listCompanyPlanChanges({
  companyId,
}: {
  companyId: string;
}) {
  return prisma.companyPlanChange.findMany({
    where: {
      companyId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

export async function getPlanUpgradeHealth() {
  const [created24h, paid24h, failed24h] = await Promise.all([
    prisma.planCheckout.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.planCheckout.count({
      where: {
        status: "PAID",
        paidAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.planCheckout.count({
      where: {
        status: "FAILED",
        failedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  return {
    enabled: isEnabled(),
    created24h,
    paid24h,
    failed24h,
    isHealthy: isEnabled() && failed24h === 0,
  };
}
