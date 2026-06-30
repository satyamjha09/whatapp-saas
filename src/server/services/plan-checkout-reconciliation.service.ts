import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  completePlanCheckout,
} from "@/server/services/plan-upgrade.service";
import { fetchCashfreePaymentsForOrder } from "@/server/services/cashfree-payment.service";
import { createCompanyNotification } from "@/server/services/company-notification.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";

function isEnabled() {
  return process.env.PLAN_CHECKOUT_RECONCILIATION_ENABLED !== "false";
}

function maxAttempts() {
  const value = Number(process.env.PLAN_CHECKOUT_MAX_RECONCILIATION_ATTEMPTS ?? 5);
  return Number.isFinite(value) && value > 0 ? value : 5;
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

async function createReconciliationEvent({
  companyId,
  checkoutId,
  status,
  source,
  cashfreeOrderId,
  cashfreePaymentId,
  attemptNumber,
  message,
  errorMessage,
  metadata,
}: {
  companyId: string;
  checkoutId: string;
  status: "PENDING" | "COMPLETED" | "FAILED" | "EXPIRED" | "SKIPPED";
  source: string;
  cashfreeOrderId?: string | null;
  cashfreePaymentId?: string | null;
  attemptNumber?: number;
  message?: string | null;
  errorMessage?: string | null;
  metadata?: unknown;
}) {
  return prisma.planCheckoutReconciliationEvent.create({
    data: {
      companyId,
      checkoutId,
      status,
      source,
      cashfreeOrderId: cashfreeOrderId ?? null,
      cashfreePaymentId: cashfreePaymentId ?? null,
      attemptNumber: attemptNumber ?? 1,
      message: message ?? null,
      errorMessage: errorMessage ?? null,
      metadata: metadata ? safeJson(metadata) : undefined,
    },
  });
}

export async function completePlanCheckoutFromWebhook({
  cashfreeOrderId,
  cashfreePaymentId,
  amountPaise,
  currency,
  payload,
}: {
  cashfreeOrderId: string;
  cashfreePaymentId: string;
  amountPaise?: number;
  currency?: string;
  payload?: unknown;
}) {
  if (!isEnabled()) {
    return {
      skipped: true,
      reason: "Plan checkout reconciliation disabled",
    };
  }

  const checkout = await prisma.planCheckout.findFirst({
    where: {
      cashfreeOrderId: cashfreeOrderId,
    },
  });

  if (!checkout) {
    return {
      skipped: true,
      reason: "No plan checkout found for Cashfree order",
    };
  }

  if (checkout.status === "PAID") {
    await createReconciliationEvent({
      companyId: checkout.companyId,
      checkoutId: checkout.id,
      status: "SKIPPED",
      source: "cashfree-webhook",
      cashfreeOrderId: cashfreeOrderId,
      cashfreePaymentId: cashfreePaymentId,
      message: "Checkout already paid",
      metadata: payload,
    });

    return {
      skipped: true,
      reason: "Checkout already paid",
      checkoutId: checkout.id,
    };
  }

  try {
    const result = await completePlanCheckout({
      companyId: checkout.companyId,
      checkoutId: checkout.id,
      actorUserId: null,
      cashfreeOrderId,
      cashfreePaymentId,
      amountPaise,
      currency,
    });

    await prisma.planCheckout.update({
      where: {
        id: checkout.id,
      },
      data: {
        webhookProcessedAt: new Date(),
        lastReconciliationAt: new Date(),
        lastReconciliationError: null,
      },
    });

    await createReconciliationEvent({
      companyId: checkout.companyId,
      checkoutId: checkout.id,
      status: "COMPLETED",
      source: "cashfree-webhook",
      cashfreeOrderId: cashfreeOrderId,
      cashfreePaymentId: cashfreePaymentId,
      message: "Checkout completed from Cashfree webhook",
      metadata: payload,
    });

    return result;
  } catch (error) {
    await prisma.planCheckout.update({
      where: {
        id: checkout.id,
      },
      data: {
        reconciliationAttempts: {
          increment: 1,
        },
        lastReconciliationAt: new Date(),
        lastReconciliationError:
          error instanceof Error ? error.message : "Unknown webhook reconciliation error",
      },
    });

    await createReconciliationEvent({
      companyId: checkout.companyId,
      checkoutId: checkout.id,
      status: "FAILED",
      source: "cashfree-webhook",
      cashfreeOrderId: cashfreeOrderId,
      cashfreePaymentId: cashfreePaymentId,
      errorMessage:
        error instanceof Error ? error.message : "Unknown webhook reconciliation error",
      metadata: payload,
    });

    throw error;
  }
}

export async function reconcileSinglePlanCheckout({
  checkoutId,
}: {
  checkoutId: string;
}) {
  const checkout = await prisma.planCheckout.findUnique({
    where: {
      id: checkoutId,
    },
  });

  if (!checkout) return null;

  if (checkout.status !== "CREATED") {
    await createReconciliationEvent({
      companyId: checkout.companyId,
      checkoutId: checkout.id,
      status: "SKIPPED",
      source: "scheduled-scan",
      cashfreeOrderId: checkout.cashfreeOrderId,
      cashfreePaymentId: checkout.cashfreePaymentId,
      message: `Checkout is ${checkout.status}`,
    });

    return null;
  }

  if (checkout.expiresAt && checkout.expiresAt < new Date()) {
    await prisma.planCheckout.update({
      where: {
        id: checkout.id,
      },
      data: {
        status: "EXPIRED",
        failedAt: new Date(),
        failureReason: "Checkout expired",
      },
    });

    await createReconciliationEvent({
      companyId: checkout.companyId,
      checkoutId: checkout.id,
      status: "EXPIRED",
      source: "scheduled-scan",
      cashfreeOrderId: checkout.cashfreeOrderId,
      message: "Checkout expired",
    });

    return {
      expired: true,
      checkoutId: checkout.id,
    };
  }

  if (!checkout.cashfreeOrderId) {
    return null;
  }

  if (checkout.reconciliationAttempts >= maxAttempts()) {
    await createReconciliationEvent({
      companyId: checkout.companyId,
      checkoutId: checkout.id,
      status: "SKIPPED",
      source: "scheduled-scan",
      cashfreeOrderId: checkout.cashfreeOrderId,
      message: "Max reconciliation attempts reached",
    });

    return null;
  }

  try {
    const payments = await fetchCashfreePaymentsForOrder(checkout.cashfreeOrderId);

    const paidPayment = payments.find(
      (payment) =>
        payment.order_id === checkout.cashfreeOrderId &&
        payment.payment_amount !== undefined &&
        Math.round(payment.payment_amount * 100) === checkout.amountPaise &&
        payment.payment_status?.toUpperCase() === "SUCCESS",
    );

    if (!paidPayment) {
      await prisma.planCheckout.update({
        where: {
          id: checkout.id,
        },
        data: {
          reconciliationAttempts: {
            increment: 1,
          },
          lastReconciliationAt: new Date(),
        },
      });

      await createReconciliationEvent({
        companyId: checkout.companyId,
        checkoutId: checkout.id,
        status: "PENDING",
        source: "scheduled-scan",
        cashfreeOrderId: checkout.cashfreeOrderId,
        attemptNumber: checkout.reconciliationAttempts + 1,
        message: "No successful Cashfree payment found yet",
        metadata: payments,
      });

      return {
        pending: true,
        checkoutId: checkout.id,
      };
    }

    await prisma.planCheckout.update({
      where: {
        id: checkout.id,
      },
      data: {
        status: "MANUAL_REVIEW",
        manualReviewReason:
          "Successful Cashfree payment found during scheduled reconciliation; manual review is required before updating the plan.",
        manualReviewOpenedAt: new Date(),
        cashfreePaymentId:
          paidPayment.cf_payment_id !== undefined
            ? String(paidPayment.cf_payment_id)
            : null,
        reconciliationAttempts: {
          increment: 1,
        },
        lastReconciliationAt: new Date(),
        lastReconciliationError:
          "Successful payment found during scheduled scan. Manual verification required.",
      },
    });

    await createReconciliationEvent({
      companyId: checkout.companyId,
      checkoutId: checkout.id,
      status: "FAILED",
      source: "scheduled-scan",
      cashfreeOrderId: checkout.cashfreeOrderId,
      cashfreePaymentId:
        paidPayment.cf_payment_id !== undefined
          ? String(paidPayment.cf_payment_id)
          : null,
      attemptNumber: checkout.reconciliationAttempts + 1,
      message: "Successful Cashfree payment found during scheduled scan",
      errorMessage:
        "Manual verification required before updating the plan.",
      metadata: paidPayment,
    });

    await createCompanyNotification({
      companyId: checkout.companyId,
      type: "BILLING",
      severity: "ERROR",
      title: "Payment reconciliation needs review",
      message:
        "A captured payment was found for a plan checkout, but manual verification is required before updating the plan.",
      actionHref: "/dashboard/system/health",
      idempotencyKey: `plan-checkout-manual-review:${checkout.id}`,
      metadata: {
        checkoutId: checkout.id,
        cashfreeOrderId: checkout.cashfreeOrderId,
        cashfreePaymentId:
          paidPayment.cf_payment_id !== undefined
            ? String(paidPayment.cf_payment_id)
            : null,
      },
    }).catch(() => undefined);

    return {
      manualReview: true,
      checkoutId: checkout.id,
      paymentId:
        paidPayment.cf_payment_id !== undefined
          ? String(paidPayment.cf_payment_id)
          : null,
    };
  } catch (error) {
    await prisma.planCheckout.update({
      where: {
        id: checkout.id,
      },
      data: {
        reconciliationAttempts: {
          increment: 1,
        },
        lastReconciliationAt: new Date(),
        lastReconciliationError:
          error instanceof Error ? error.message : "Unknown reconciliation error",
      },
    });

    await createReconciliationEvent({
      companyId: checkout.companyId,
      checkoutId: checkout.id,
      status: "FAILED",
      source: "scheduled-scan",
      cashfreeOrderId: checkout.cashfreeOrderId,
      attemptNumber: checkout.reconciliationAttempts + 1,
      errorMessage:
        error instanceof Error ? error.message : "Unknown reconciliation error",
    });

    throw error;
  }
}

export async function scanPlanCheckoutReconciliation() {
  if (!isEnabled()) {
    return {
      skipped: true,
      reason: "Plan checkout reconciliation disabled",
    };
  }

  const checkouts = await prisma.planCheckout.findMany({
    where: {
      status: "CREATED",
      OR: [
        {
          expiresAt: {
            lte: new Date(),
          },
        },
        {
          reconciliationAttempts: {
            lt: maxAttempts(),
          },
        },
      ],
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 100,
  });

  let checked = 0;
  let expired = 0;
  let pending = 0;
  let manualReview = 0;
  let failed = 0;

  for (const checkout of checkouts) {
    checked += 1;

    try {
      const result = await reconcileSinglePlanCheckout({
        checkoutId: checkout.id,
      });

      if (result && "expired" in result) expired += 1;
      if (result && "pending" in result) pending += 1;
      if (result && "manualReview" in result) manualReview += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    checked,
    expired,
    pending,
    manualReview,
    failed,
  };
}

export async function getPlanCheckoutReconciliationHealth() {
  const [createdOpen, expired24h, failed24h, manualReview24h] =
    await Promise.all([
      prisma.planCheckout.count({
        where: {
          status: "CREATED",
        },
      }),
      prisma.planCheckoutReconciliationEvent.count({
        where: {
          status: "EXPIRED",
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.planCheckoutReconciliationEvent.count({
        where: {
          status: "FAILED",
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.planCheckoutReconciliationEvent.count({
        where: {
          status: "FAILED",
          message: {
            contains: "Successful Cashfree payment found",
          },
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

  return {
    enabled: isEnabled(),
    createdOpen,
    expired24h,
    failed24h,
    manualReview24h,
    isHealthy: isEnabled() && manualReview24h === 0,
  };
}
