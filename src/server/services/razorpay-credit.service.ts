import crypto from "crypto";
import { MESSAGE_PRICE_PAISE } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";

export type RazorpayWebhookPayload = {
  event?: string;
  contains?: string[];
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount?: number;
        currency?: string;
        status?: string;
        error_description?: string;
      };
    };
    order?: {
      entity?: {
        id?: string;
        amount?: number;
        currency?: string;
        status?: string;
      };
    };
  };
  created_at?: number;
  event_id?: string;
  id?: string;
};

export function isRazorpayWebhookConfigured() {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  return Boolean(secret && secret !== "your_razorpay_webhook_secret");
}

export function verifyRazorpayWebhookSignature({
  rawBody,
  signature,
}: {
  rawBody: string;
  signature: string;
}) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (
    !webhookSecret ||
    webhookSecret === "your_razorpay_webhook_secret"
  ) {
    throw new Error("Razorpay webhook secret is not configured");
  }

  if (!/^[a-f\d]{64}$/i.test(signature)) return false;

  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const receivedBuffer = Buffer.from(signature, "hex");

  return (
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

export function extractCreditPaymentFromWebhook(
  payload: RazorpayWebhookPayload,
) {
  const payment = payload.payload?.payment?.entity;
  const order = payload.payload?.order?.entity;

  return {
    eventType: payload.event ?? "unknown",
    razorpayOrderId: payment?.order_id ?? order?.id,
    razorpayPaymentId: payment?.id,
    amountPaise: payment?.amount ?? order?.amount,
    currency: payment?.currency ?? order?.currency,
    paymentStatus: payment?.status,
    orderStatus: order?.status,
    failureReason: payment?.error_description,
  };
}

export async function markRazorpayCreditPurchasePaidFromWebhook({
  amountPaise,
  currency,
  razorpayOrderId,
  razorpayPaymentId,
}: {
  amountPaise?: number;
  currency?: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.creditPurchase.findUnique({
      where: { razorpayOrderId },
    });

    if (!purchase) throw new Error("Credit purchase not found");
    if (amountPaise !== undefined && amountPaise !== purchase.amountPaise) {
      throw new Error("Razorpay payment amount mismatch");
    }
    if (currency && currency.toUpperCase() !== purchase.currency.toUpperCase()) {
      throw new Error("Razorpay payment currency mismatch");
    }
    if (purchase.credits <= 0) {
      throw new Error("Credit purchase has an invalid credit quantity");
    }

    const existingTransaction = await tx.walletTransaction.findUnique({
      where: {
        companyId_referenceType_referenceId_type: {
          companyId: purchase.companyId,
          referenceType: "RAZORPAY_PAYMENT",
          referenceId: razorpayPaymentId,
          type: "CREDIT",
        },
      },
    });

    if (purchase.status === "PAID" || existingTransaction) {
      const paidPurchase =
        purchase.status === "PAID"
          ? purchase
          : await tx.creditPurchase.update({
              where: { id: purchase.id },
              data: {
                status: "PAID",
                razorpayPaymentId,
                paidAt: new Date(),
                failedAt: null,
                failureReason: null,
              },
            });

      return {
        alreadyPaid: true,
        purchase: paidPurchase,
        transaction: existingTransaction,
      };
    }

    const claimed = await tx.creditPurchase.updateMany({
      where: {
        id: purchase.id,
        status: { not: "PAID" },
      },
      data: {
        status: "PAID",
        razorpayPaymentId,
        paidAt: new Date(),
        failedAt: null,
        failureReason: null,
      },
    });

    if (claimed.count === 0) {
      const paidPurchase = await tx.creditPurchase.findUniqueOrThrow({
        where: { id: purchase.id },
      });

      return {
        alreadyPaid: true,
        purchase: paidPurchase,
        transaction: null,
      };
    }

    const walletCreditPaise = purchase.credits * MESSAGE_PRICE_PAISE;
    const wallet = await tx.wallet.upsert({
      where: { companyId: purchase.companyId },
      update: {
        balancePaise: { increment: walletCreditPaise },
      },
      create: {
        companyId: purchase.companyId,
        balancePaise: walletCreditPaise,
      },
    });
    const transaction = await tx.walletTransaction.create({
      data: {
        companyId: purchase.companyId,
        type: "CREDIT",
        status: "COMPLETED",
        amountPaise: walletCreditPaise,
        balanceAfterPaise: wallet.balancePaise,
        description: `Purchased ${purchase.credits} message credits via Razorpay`,
        referenceType: "RAZORPAY_PAYMENT",
        referenceId: razorpayPaymentId,
        createdByUserId: purchase.userId,
        completedAt: new Date(),
      },
    });
    const paidPurchase = await tx.creditPurchase.findUniqueOrThrow({
      where: { id: purchase.id },
    });

    return {
      alreadyPaid: false,
      purchase: paidPurchase,
      transaction,
      wallet,
    };
  });
}

export async function markRazorpayCreditPurchaseFailedFromWebhook({
  failureReason,
  razorpayOrderId,
  razorpayPaymentId,
}: {
  failureReason?: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.creditPurchase.findUnique({
      where: { razorpayOrderId },
    });

    if (!purchase) throw new Error("Credit purchase not found");

    const failed = await tx.creditPurchase.updateMany({
      where: {
        id: purchase.id,
        status: { not: "PAID" },
      },
      data: {
        status: "FAILED",
        razorpayPaymentId: razorpayPaymentId ?? purchase.razorpayPaymentId,
        failedAt: new Date(),
        failureReason: failureReason ?? "Razorpay payment failed",
      },
    });
    const latestPurchase = await tx.creditPurchase.findUniqueOrThrow({
      where: { id: purchase.id },
    });

    return {
      ignored: failed.count === 0,
      purchase: latestPurchase,
    };
  });
}
