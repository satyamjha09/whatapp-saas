import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createCompanyNotification } from "@/server/services/company-notification.service";
import { createAuditLog } from "@/server/services/audit.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";
import { fetchCashfreeRefund } from "@/server/services/cashfree-payment.service";

export class BillingRefundReconciliationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingRefundReconciliationError";
  }
}

function isEnabled() {
  return process.env.BILLING_REFUND_RECONCILIATION_ENABLED !== "false";
}

function shouldNotifyFailed() {
  return process.env.BILLING_REFUND_NOTIFY_FAILED !== "false";
}

function maxAttempts() {
  const value = Number(process.env.BILLING_REFUND_MAX_RECONCILIATION_ATTEMPTS ?? 8);
  return Number.isFinite(value) && value > 0 ? value : 8;
}

function staleProcessingHours() {
  const value = Number(process.env.BILLING_REFUND_STALE_PROCESSING_HOURS ?? 24);
  return Number.isFinite(value) && value > 0 ? value : 24;
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

function normalizeRefundStatus(status?: string | null) {
  const normalized = String(status ?? "").toUpperCase();
  if (normalized === "SUCCESS" || normalized === "PROCESSED") return "PROCESSED";
  if (
    normalized === "FAILED" ||
    normalized === "FAILURE" ||
    normalized === "CANCELLED" ||
    normalized === "CANCELED"
  ) {
    return "FAILED";
  }
  return "PENDING";
}

async function createRefundReconciliationEvent({
  companyId,
  refundId,
  status,
  source,
  cashfreeRefundId,
  cashfreePaymentId,
  cashfreeStatus,
  attemptNumber,
  message,
  errorMessage,
  metadata,
}: {
  companyId: string;
  refundId: string;
  status: "PENDING" | "PROCESSED" | "FAILED" | "SKIPPED";
  source: string;
  cashfreeRefundId?: string | null;
  cashfreePaymentId?: string | null;
  cashfreeStatus?: string | null;
  attemptNumber?: number;
  message?: string | null;
  errorMessage?: string | null;
  metadata?: unknown;
}) {
  return prisma.billingRefundReconciliationEvent.create({
    data: {
      companyId,
      refundId,
      status,
      source,
      cashfreeRefundId: cashfreeRefundId ?? null,
      cashfreePaymentId: cashfreePaymentId ?? null,
      cashfreeStatus: cashfreeStatus ?? null,
      attemptNumber: attemptNumber ?? 1,
      message: message ?? null,
      errorMessage: errorMessage ?? null,
      metadata: metadata ? safeJson(metadata) : undefined,
    },
  });
}

async function notifyRefundFailed({
  companyId,
  refundId,
  amountPaise,
  reason,
}: {
  companyId: string;
  refundId: string;
  amountPaise: number;
  reason?: string | null;
}) {
  if (!shouldNotifyFailed()) return;

  await createCompanyNotification({
    companyId,
    type: "BILLING",
    severity: "ERROR",
    title: "Refund failed",
    message: `A refund of ₹${(amountPaise / 100).toLocaleString(
      "en-IN",
    )} failed. Please review Billing Refunds.`,
    actionHref: "/dashboard/billing/refunds",
    idempotencyKey: `billing-refund-failed:${refundId}`,
    metadata: {
      refundId,
      reason,
    },
  }).catch(() => undefined);
}

export async function applyRefundStatusUpdate({
  refundId,
  cashfreeStatus,
  source,
  payload,
}: {
  refundId: string;
  cashfreeStatus: string;
  source: string;
  payload?: unknown;
}) {
  const refund = await prisma.billingRefund.findUnique({
    where: {
      id: refundId,
    },
    include: {
      creditNote: true,
    },
  });

  if (!refund) {
    throw new BillingRefundReconciliationError("Refund not found.");
  }

  const nextStatus = normalizeRefundStatus(cashfreeStatus);

  if (refund.status === nextStatus) {
    await createRefundReconciliationEvent({
      companyId: refund.companyId,
      refundId: refund.id,
      status: "SKIPPED",
      source,
      cashfreeRefundId: refund.cashfreeRefundId,
      cashfreePaymentId: refund.cashfreePaymentId,
      cashfreeStatus,
      message: `Refund already ${nextStatus}`,
      metadata: payload,
    });
    return { skipped: true, refund };
  }

  if (nextStatus === "PROCESSED") {
    const updatedRefund = await prisma.billingRefund.update({
      where: {
        id: refund.id,
      },
      data: {
        status: "PROCESSED",
        cashfreeStatus,
        processedAt: refund.processedAt ?? new Date(),
        webhookProcessedAt: source === "cashfree-webhook" ? new Date() : refund.webhookProcessedAt,
        lastReconciliationAt: new Date(),
        lastReconciliationError: null,
      },
    });

    await createRefundReconciliationEvent({
      companyId: refund.companyId,
      refundId: refund.id,
      status: "PROCESSED",
      source,
      cashfreeRefundId: refund.cashfreeRefundId,
      cashfreePaymentId: refund.cashfreePaymentId,
      cashfreeStatus,
      message: "Refund marked processed.",
      metadata: payload,
    });

    await createAuditLog({
      companyId: refund.companyId,
      actorUserId: refund.requestedByUserId ?? undefined,
      action: "billing.refund_processed",
      entityType: "BillingRefund",
      entityId: refund.id,
      metadata: {
        source,
        cashfreeRefundId: refund.cashfreeRefundId,
        cashfreePaymentId: refund.cashfreePaymentId,
      },
    }).catch(() => undefined);

    return { refund: updatedRefund };
  }

  if (nextStatus === "FAILED") {
    const updatedRefund = await prisma.billingRefund.update({
      where: {
        id: refund.id,
      },
      data: {
        status: "FAILED",
        cashfreeStatus,
        failedAt: new Date(),
        failureReason: "Cashfree refund failed",
        webhookProcessedAt: source === "cashfree-webhook" ? new Date() : refund.webhookProcessedAt,
        lastReconciliationAt: new Date(),
        lastReconciliationError: "Cashfree refund failed",
      },
    });

    if (refund.creditNote) {
      await prisma.billingCreditNote.update({
        where: {
          id: refund.creditNote.id,
        },
        data: {
          status: "VOID",
          voidedAt: new Date(),
        },
      });
    }

    await createRefundReconciliationEvent({
      companyId: refund.companyId,
      refundId: refund.id,
      status: "FAILED",
      source,
      cashfreeRefundId: refund.cashfreeRefundId,
      cashfreePaymentId: refund.cashfreePaymentId,
      cashfreeStatus,
      message: "Refund marked failed.",
      errorMessage: "Cashfree refund failed",
      metadata: payload,
    });

    await notifyRefundFailed({
      companyId: refund.companyId,
      refundId: refund.id,
      amountPaise: refund.amountPaise,
      reason: "Cashfree refund failed",
    });

    await createAuditLog({
      companyId: refund.companyId,
      actorUserId: refund.requestedByUserId ?? undefined,
      action: "billing.refund_failed_by_reconciliation",
      entityType: "BillingRefund",
      entityId: refund.id,
      metadata: {
        source,
        cashfreeRefundId: refund.cashfreeRefundId,
        cashfreePaymentId: refund.cashfreePaymentId,
      },
    }).catch(() => undefined);

    return { refund: updatedRefund };
  }

  const updatedRefund = await prisma.billingRefund.update({
    where: {
      id: refund.id,
    },
    data: {
      status: "PROCESSING",
      cashfreeStatus,
      lastReconciliationAt: new Date(),
    },
  });

  await createRefundReconciliationEvent({
    companyId: refund.companyId,
    refundId: refund.id,
    status: "PENDING",
    source,
    cashfreeRefundId: refund.cashfreeRefundId,
    cashfreePaymentId: refund.cashfreePaymentId,
    cashfreeStatus,
    message: "Refund is still pending.",
    metadata: payload,
  });

  return { refund: updatedRefund };
}

export interface CashfreeRefundWebhookPayload {
  type?: string;
  data?: {
    refund?: {
      cf_refund_id?: number | string;
      refund_id?: string;
      refund_status?: string;
      order_id?: string;
    };
  };
}

export async function processRefundWebhookPayload({
  payload,
}: {
  payload: CashfreeRefundWebhookPayload;
}) {
  if (!isEnabled()) {
    return { skipped: true, reason: "Billing refund reconciliation disabled" };
  }

  const refundEntity = payload?.data?.refund;
  const refundId =
    refundEntity?.refund_id ??
    (refundEntity?.cf_refund_id !== undefined
      ? String(refundEntity.cf_refund_id)
      : undefined);

  if (!refundEntity || !refundId) {
    return { skipped: true, reason: "No refund entity in payload" };
  }

  const refund = await prisma.billingRefund.findFirst({
    where: {
      cashfreeRefundId: refundId,
    },
  });

  if (!refund) {
    return {
      skipped: true,
      reason: "No local refund matched Cashfree refund id",
      cashfreeRefundId: refundId,
    };
  }

  return applyRefundStatusUpdate({
    refundId: refund.id,
    cashfreeStatus: refundEntity.refund_status ?? "",
    source: "cashfree-webhook",
    payload,
  });
}

export async function reconcileSingleBillingRefund({
  refundId,
}: {
  refundId: string;
}) {
  if (!isEnabled()) {
    return { skipped: true, reason: "Billing refund reconciliation disabled" };
  }

  const refund = await prisma.billingRefund.findUnique({
    where: {
      id: refundId,
    },
    include: {
      invoice: {
        select: {
          cashfreeOrderId: true,
        },
      },
    },
  });

  if (!refund) return null;

  if (!["PROCESSING", "REQUESTED"].includes(refund.status)) {
    await createRefundReconciliationEvent({
      companyId: refund.companyId,
      refundId: refund.id,
      status: "SKIPPED",
      source: "scheduled-scan",
      cashfreeRefundId: refund.cashfreeRefundId,
      cashfreePaymentId: refund.cashfreePaymentId,
      cashfreeStatus: refund.cashfreeStatus,
      message: `Refund is ${refund.status}`,
    });
    return null;
  }

  if (!refund.cashfreeRefundId) {
    await createRefundReconciliationEvent({
      companyId: refund.companyId,
      refundId: refund.id,
      status: "FAILED",
      source: "scheduled-scan",
      cashfreePaymentId: refund.cashfreePaymentId,
      errorMessage: "Refund has no Cashfree refund id",
    });
    return null;
  }

  if (!refund.invoice?.cashfreeOrderId) {
    await createRefundReconciliationEvent({
      companyId: refund.companyId,
      refundId: refund.id,
      status: "FAILED",
      source: "scheduled-scan",
      cashfreeRefundId: refund.cashfreeRefundId,
      cashfreePaymentId: refund.cashfreePaymentId,
      errorMessage: "Refund has no Cashfree order id",
    });
    return null;
  }

  if (refund.reconciliationAttempts >= maxAttempts()) {
    await createRefundReconciliationEvent({
      companyId: refund.companyId,
      refundId: refund.id,
      status: "SKIPPED",
      source: "scheduled-scan",
      cashfreeRefundId: refund.cashfreeRefundId,
      cashfreePaymentId: refund.cashfreePaymentId,
      message: "Max reconciliation attempts reached",
    });
    return null;
  }

  try {
    const cashfreeRefund = await fetchCashfreeRefund({
      orderId: refund.invoice.cashfreeOrderId,
      refundId: refund.cashfreeRefundId,
    });

    await prisma.billingRefund.update({
      where: {
        id: refund.id,
      },
      data: {
        reconciliationAttempts: {
          increment: 1,
        },
        lastReconciliationAt: new Date(),
      },
    });

    return applyRefundStatusUpdate({
      refundId: refund.id,
      cashfreeStatus: cashfreeRefund.refund_status ?? "",
      source: "scheduled-scan",
      payload: cashfreeRefund,
    });
  } catch (error) {
    await prisma.billingRefund.update({
      where: {
        id: refund.id,
      },
      data: {
        reconciliationAttempts: {
          increment: 1,
        },
        lastReconciliationAt: new Date(),
        lastReconciliationError: error instanceof Error ? error.message : "Unknown refund reconciliation error",
      },
    });

    await createRefundReconciliationEvent({
      companyId: refund.companyId,
      refundId: refund.id,
      status: "FAILED",
      source: "scheduled-scan",
      cashfreeRefundId: refund.cashfreeRefundId,
      cashfreePaymentId: refund.cashfreePaymentId,
      attemptNumber: refund.reconciliationAttempts + 1,
      errorMessage: error instanceof Error ? error.message : "Unknown refund reconciliation error",
    });

    throw error;
  }
}

export async function scanBillingRefundReconciliation() {
  if (!isEnabled()) {
    return { skipped: true, reason: "Billing refund reconciliation disabled" };
  }

  const refunds = await prisma.billingRefund.findMany({
    where: {
      status: {
        in: ["REQUESTED", "PROCESSING"],
      },
      reconciliationAttempts: {
        lt: maxAttempts(),
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 100,
  });

  let checked = 0;
  let processed = 0;
  let pending = 0;
  let failed = 0;

  for (const refund of refunds) {
    checked += 1;
    try {
      const result = await reconcileSingleBillingRefund({
        refundId: refund.id,
      });

      const status = result && "refund" in result ? result.refund.status : null;
      if (status === "PROCESSED") processed += 1;
      else if (status === "FAILED") failed += 1;
      else pending += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    checked,
    processed,
    pending,
    failed,
  };
}

export async function getBillingRefundReconciliationHealth() {
  const staleCutoff = new Date(
    Date.now() - staleProcessingHours() * 60 * 60 * 1000,
  );

  const [processing, staleProcessing, processed24h, failed24h] = await Promise.all([
    prisma.billingRefund.count({
      where: {
        status: "PROCESSING",
      },
    }),
    prisma.billingRefund.count({
      where: {
        status: "PROCESSING",
        createdAt: {
          lt: staleCutoff,
        },
      },
    }),
    prisma.billingRefundReconciliationEvent.count({
      where: {
        status: "PROCESSED",
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.billingRefundReconciliationEvent.count({
      where: {
        status: "FAILED",
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  return {
    enabled: isEnabled(),
    processing,
    staleProcessing,
    processed24h,
    failed24h,
    isHealthy: !isEnabled() || staleProcessing === 0,
  };
}
