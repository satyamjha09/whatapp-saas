import crypto from "node:crypto";
import { BillingPlan, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getBillingPlanConfig } from "@/server/config/billing-plans";
import { createAuditLog } from "@/server/services/audit.service";
import { createPaidPlanUpgradeInvoice } from "@/server/services/billing-invoice.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";

export class PlanUpgradeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanUpgradeError";
  }
}

type RazorpayOrderResponse = {
  id?: string;
  amount?: number;
  currency?: string;
  status?: string;
  error?: {
    description?: string;
  };
};

function isEnabled() {
  return process.env.PLAN_UPGRADES_ENABLED !== "false";
}

function currency() {
  return process.env.PLAN_UPGRADE_CURRENCY || "INR";
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

function razorpayAuthHeader() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new PlanUpgradeError("Razorpay credentials are not configured.");
  }

  return {
    keyId,
    authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString(
      "base64",
    )}`,
  };
}

async function createRazorpayOrder({
  amountPaise,
  receipt,
  notes,
}: {
  amountPaise: number;
  receipt: string;
  notes: Record<string, string>;
}) {
  const { authorization } = razorpayAuthHeader();
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: currency(),
      receipt,
      notes,
    }),
  });
  const data = (await response.json()) as RazorpayOrderResponse;

  if (!response.ok) {
    throw new PlanUpgradeError(
      data.error?.description ?? "Unable to create Razorpay order.",
    );
  }

  if (
    !data.id ||
    data.amount !== amountPaise ||
    data.currency?.toUpperCase() !== currency().toUpperCase()
  ) {
    throw new PlanUpgradeError("Razorpay returned an invalid order.");
  }

  return {
    id: data.id,
    amount: data.amount,
    currency: data.currency,
    status: data.status ?? "created",
  };
}

function verifyRazorpaySignature({
  orderId,
  paymentId,
  signature,
}: {
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  const secret = process.env.RAZORPAY_KEY_SECRET;

  if (!secret) {
    throw new PlanUpgradeError("RAZORPAY_KEY_SECRET is missing.");
  }

  if (!/^[a-f\d]{64}$/i.test(signature)) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(signature, "hex");

  return (
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  );
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
      metadata: safeJson({
        companyName: company.name,
      }),
    },
  });

  const order = await createRazorpayOrder({
    amountPaise,
    receipt: checkout.id,
    notes: {
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
      razorpayOrderId: order.id,
      metadata: safeJson({
        companyName: company.name,
        razorpayOrder: order,
      }),
    },
  });
}

export async function completePlanCheckout({
  companyId,
  checkoutId,
  actorUserId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}: {
  companyId: string;
  checkoutId: string;
  actorUserId?: string | null;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  const checkout = await prisma.planCheckout.findFirst({
    where: {
      id: checkoutId,
      companyId,
      status: "CREATED",
    },
    include: {
      company: true,
    },
  });

  if (!checkout) {
    throw new PlanUpgradeError("Active checkout not found.");
  }

  if (checkout.razorpayOrderId !== razorpayOrderId) {
    throw new PlanUpgradeError("Razorpay order mismatch.");
  }

  const verified = verifyRazorpaySignature({
    orderId: razorpayOrderId,
    paymentId: razorpayPaymentId,
    signature: razorpaySignature,
  });

  if (!verified) {
    await prisma.planCheckout.update({
      where: {
        id: checkout.id,
      },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        failureReason: "Invalid Razorpay signature",
      },
    });

    throw new PlanUpgradeError("Invalid payment signature.");
  }

  const newMonthlyMessageLimit = getPlanMonthlyMessageLimit(checkout.toPlan);

  const result = await prisma.$transaction(async (tx) => {
    const updatedCheckout = await tx.planCheckout.update({
      where: {
        id: checkout.id,
      },
      data: {
        status: "PAID",
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
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
          razorpayOrderId,
          razorpayPaymentId,
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
      razorpayOrderId,
      razorpayPaymentId,
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
    razorpayOrderId,
    razorpayPaymentId,
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
