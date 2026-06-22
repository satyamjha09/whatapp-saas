import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getBillingPlanConfig } from "@/server/config/billing-plans";
import { addOneMonth } from "@/server/services/subscription.service";
import type {
  CreateRazorpaySubscriptionOrderInput,
  VerifyRazorpaySubscriptionPaymentInput,
} from "@/server/validators/razorpay-subscription.validator";

const placeholderValues = new Set([
  "your_razorpay_key_id",
  "your_razorpay_key_secret",
]);

export function getRazorpayCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (
    !keyId ||
    !keySecret ||
    placeholderValues.has(keyId) ||
    placeholderValues.has(keySecret)
  ) {
    throw new Error("Razorpay credentials are not configured");
  }

  return { keyId, keySecret };
}

export function isRazorpayCheckoutConfigured() {
  try {
    getRazorpayCredentials();
    return true;
  } catch {
    return false;
  }
}

function getNextBillingPeriod(currentPeriodEnd?: Date | null) {
  const now = new Date();
  const periodStart =
    currentPeriodEnd && currentPeriodEnd > now ? currentPeriodEnd : now;

  return { periodStart, periodEnd: addOneMonth(periodStart) };
}

function verifyPaymentSignature({
  orderId,
  paymentId,
  signature,
  secret,
}: {
  orderId: string;
  paymentId: string;
  signature: string;
  secret: string;
}) {
  if (!/^[a-f\d]{64}$/i.test(signature)) return false;

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

type RazorpayOrderResponse = {
  id?: string;
  amount?: number;
  currency?: string;
  status?: string;
  error?: { description?: string };
};

export async function createRazorpaySubscriptionOrder({
  companyId,
  userId,
  input,
}: {
  companyId: string;
  userId: string;
  input: CreateRazorpaySubscriptionOrderInput;
}) {
  const plan = getBillingPlanConfig(input.plan);

  if (plan.id === "FREE") throw new Error("Free plan does not require payment");

  const { keyId, keySecret } = getRazorpayCredentials();
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { billingPlan: true, currentPeriodEnd: true },
  });

  if (!company) throw new Error("Company not found");

  const isSamePlanRenewal = company.billingPlan === plan.id;
  const { periodStart, periodEnd } = getNextBillingPeriod(
    isSamePlanRenewal ? company.currentPeriodEnd : null,
  );
  const receipt = `sub_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`.slice(0, 40);
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: plan.monthlyPricePaise,
      currency: "INR",
      receipt,
      notes: {
        type: "SUBSCRIPTION_PLAN",
        companyId,
        userId,
        plan: plan.id,
        monthlyMessageLimit: String(plan.monthlyMessageLimit),
      },
    }),
  });
  const data = (await response.json()) as RazorpayOrderResponse;

  if (!response.ok) {
    throw new Error(data.error?.description ?? "Unable to create Razorpay order");
  }
  if (
    !data.id ||
    data.amount !== plan.monthlyPricePaise ||
    data.currency?.toUpperCase() !== "INR"
  ) {
    throw new Error("Razorpay returned an invalid order");
  }

  const payment = await prisma.subscriptionPayment.create({
    data: {
      companyId,
      userId,
      plan: plan.id,
      amountPaise: plan.monthlyPricePaise,
      currency: "INR",
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      razorpayOrderId: data.id,
    },
  });

  return {
    keyId,
    payment,
    order: {
      id: data.id,
      amount: data.amount,
      currency: data.currency,
      status: data.status ?? "created",
    },
    plan,
  };
}

async function activateSubscriptionPayment({
  amountPaise,
  currency,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}: {
  amountPaise?: number;
  currency?: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.subscriptionPayment.findUnique({
      where: { razorpayOrderId },
    });

    if (!payment) throw new Error("Subscription payment not found");
    if (amountPaise !== undefined && amountPaise !== payment.amountPaise) {
      throw new Error("Razorpay payment amount mismatch");
    }
    if (currency && currency.toUpperCase() !== payment.currency.toUpperCase()) {
      throw new Error("Razorpay payment currency mismatch");
    }
    if (payment.status === "PAID") {
      return { alreadyPaid: true, payment, company: null, plan: getBillingPlanConfig(payment.plan) };
    }

    const claimed = await tx.subscriptionPayment.updateMany({
      where: { id: payment.id, status: { not: "PAID" } },
      data: {
        status: "PAID",
        razorpayPaymentId,
        razorpaySignature: razorpaySignature ?? payment.razorpaySignature,
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

export async function verifyRazorpaySubscriptionPayment({
  companyId,
  input,
}: {
  companyId: string;
  userId: string;
  input: VerifyRazorpaySubscriptionPaymentInput;
}) {
  const { keySecret } = getRazorpayCredentials();
  const payment = await prisma.subscriptionPayment.findFirst({
    where: { companyId, razorpayOrderId: input.razorpayOrderId },
  });

  if (!payment) throw new Error("Subscription payment not found");
  if (
    !verifyPaymentSignature({
      orderId: input.razorpayOrderId,
      paymentId: input.razorpayPaymentId,
      signature: input.razorpaySignature,
      secret: keySecret,
    })
  ) {
    await prisma.subscriptionPayment.updateMany({
      where: { id: payment.id, status: { not: "PAID" } },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        failureReason: "Invalid Razorpay signature",
      },
    });
    throw new Error("Invalid Razorpay signature");
  }

  return activateSubscriptionPayment({
    razorpayOrderId: input.razorpayOrderId,
    razorpayPaymentId: input.razorpayPaymentId,
    razorpaySignature: input.razorpaySignature,
  });
}

export async function markRazorpaySubscriptionPaymentPaidFromWebhook(input: {
  amountPaise?: number;
  currency?: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
}) {
  return activateSubscriptionPayment(input);
}

export async function markRazorpaySubscriptionPaymentFailedFromWebhook({
  failureReason,
  razorpayOrderId,
  razorpayPaymentId,
}: {
  failureReason?: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
}) {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { razorpayOrderId },
  });

  if (!payment) throw new Error("Subscription payment not found");
  await prisma.subscriptionPayment.updateMany({
    where: { id: payment.id, status: { not: "PAID" } },
    data: {
      status: "FAILED",
      razorpayPaymentId: razorpayPaymentId ?? payment.razorpayPaymentId,
      failedAt: new Date(),
      failureReason: failureReason ?? "Razorpay payment failed",
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
