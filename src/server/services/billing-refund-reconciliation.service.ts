import axios from "axios";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createCompanyNotification } from "@/server/services/company-notification.service";
import { createAuditLog } from "@/server/services/audit.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";

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

function razorpayAuth() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new BillingRefundReconciliationError(
      "Razorpay credentials are not configured.",
    );
  }

  return {
    username: keyId,
    password: keySecret,
  };
}

function normalizeRefundStatus(status?: string | null) {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized === "processed") return "PROCESSED";
  if (normalized === "failed") return "FAILED";
  return "PENDING";
}

async function createRefundReconciliationEvent({
  companyId,
  refundId,
  status,
  source,
  razorpayRefundId,
  razorpayPaymentId,
  razorpayStatus,
  attemptNumber,
  message,
  errorMessage,
  metadata,
}: {
  companyId: string;
  refundId: string;
  status: "PENDING" | "PROCESSED" | "FAILED" | "SKIPPED";
  source: string;
  razorpayRefundId?: string | null;
  razorpayPaymentId?: string | null;
  razorpayStatus?: string | null;
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
      razorpayRefundId: razorpayRefundId ?? null,
      razorpayPaymentId: razorpayPaymentId ?? null,
      razorpayStatus: razorpayStatus ?? null,
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
  razorpayStatus,
  source,
  payload,
}: {
  refundId: string;
  razorpayStatus: string;
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

  const nextStatus = normalizeRefundStatus(razorpayStatus);

  if (refund.status === nextStatus) {
    await createRefundReconciliationEvent({
      companyId: refund.companyId,
      refundId: refund.id,
      status: "SKIPPED",
      source,
      razorpayRefundId: refund.razorpayRefundId,
      razorpayPaymentId: refund.razorpayPaymentId,
      razorpayStatus,
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
        razorpayStatus,
        processedAt: refund.processedAt ?? new Date(),
        webhookProcessedAt: source === "razorpay-webhook" ? new Date() : refund.webhookProcessedAt,
        lastReconciliationAt: new Date(),
        lastReconciliationError: null,
      },
    });

    await createRefundReconciliationEvent({
      companyId: refund.companyId,
      refundId: refund.id,
      status: "PROCESSED",
      source,
      razorpayRefundId: refund.razorpayRefundId,
      razorpayPaymentId: refund.razorpayPaymentId,
      razorpayStatus,
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
        razorpayRefundId: refund.razorpayRefundId,
        razorpayPaymentId: refund.razorpayPaymentId,
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
        razorpayStatus,
        failedAt: new Date(),
        failureReason: "Razorpay refund failed",
        webhookProcessedAt: source === "razorpay-webhook" ? new Date() : refund.webhookProcessedAt,
        lastReconciliationAt: new Date(),
        lastReconciliationError: "Razorpay refund failed",
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
      razorpayRefundId: refund.razorpayRefundId,
      razorpayPaymentId: refund.razorpayPaymentId,
      razorpayStatus,
      message: "Refund marked failed.",
      errorMessage: "Razorpay refund failed",
      metadata: payload,
    });

    await notifyRefundFailed({
      companyId: refund.companyId,
      refundId: refund.id,
      amountPaise: refund.amountPaise,
      reason: "Razorpay refund failed",
    });

    await createAuditLog({
      companyId: refund.companyId,
      actorUserId: refund.requestedByUserId ?? undefined,
      action: "billing.refund_failed_by_reconciliation",
      entityType: "BillingRefund",
      entityId: refund.id,
      metadata: {
        source,
        razorpayRefundId: refund.razorpayRefundId,
        razorpayPaymentId: refund.razorpayPaymentId,
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
      razorpayStatus,
      lastReconciliationAt: new Date(),
    },
  });

  await createRefundReconciliationEvent({
    companyId: refund.companyId,
    refundId: refund.id,
    status: "PENDING",
    source,
    razorpayRefundId: refund.razorpayRefundId,
    razorpayPaymentId: refund.razorpayPaymentId,
    razorpayStatus,
    message: "Refund is still pending.",
    metadata: payload,
  });

  return { refund: updatedRefund };
}

export interface RazorpayRefundWebhookPayload {
  event?: string;
  payload?: {
    refund?: {
      entity?: {
        id?: string;
        status?: string;
      };
    };
  };
}

export async function processRefundWebhookPayload({
  payload,
}: {
  payload: RazorpayRefundWebhookPayload;
}) {
  if (!isEnabled()) {
    return { skipped: true, reason: "Billing refund reconciliation disabled" };
  }

  const event = payload?.event;
  const refundEntity = payload?.payload?.refund?.entity;

  if (!refundEntity?.id) {
    return { skipped: true, reason: "No refund entity in payload" };
  }

  const refund = await prisma.billingRefund.findFirst({
    where: {
      razorpayRefundId: refundEntity.id,
    },
  });

  if (!refund) {
    return {
      skipped: true,
      reason: "No local refund matched Razorpay refund id",
      razorpayRefundId: refundEntity.id,
    };
  }

  const status = event === "refund.failed" ? "failed" : event === "refund.processed" ? "processed" : (refundEntity.status ?? "");

  return applyRefundStatusUpdate({
    refundId: refund.id,
    razorpayStatus: status,
    source: "razorpay-webhook",
    payload,
  });
}

async function fetchRazorpayRefund({
  razorpayRefundId,
}: {
  razorpayRefundId: string;
}) {
  const response = await axios.get(
    `https://api.razorpay.com/v1/refunds/${razorpayRefundId}`,
    {
      auth: razorpayAuth(),
    },
  );

  return response.data as {
    id: string;
    payment_id: string;
    amount: number;
    status: string;
  };
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
  });

  if (!refund) return null;

  if (!["PROCESSING", "REQUESTED"].includes(refund.status)) {
    await createRefundReconciliationEvent({
      companyId: refund.companyId,
      refundId: refund.id,
      status: "SKIPPED",
      source: "scheduled-scan",
      razorpayRefundId: refund.razorpayRefundId,
      razorpayPaymentId: refund.razorpayPaymentId,
      razorpayStatus: refund.razorpayStatus,
      message: `Refund is ${refund.status}`,
    });
    return null;
  }

  if (!refund.razorpayRefundId) {
    await createRefundReconciliationEvent({
      companyId: refund.companyId,
      refundId: refund.id,
      status: "FAILED",
      source: "scheduled-scan",
      razorpayPaymentId: refund.razorpayPaymentId,
      errorMessage: "Refund has no Razorpay refund id",
    });
    return null;
  }

  if (refund.reconciliationAttempts >= maxAttempts()) {
    await createRefundReconciliationEvent({
      companyId: refund.companyId,
      refundId: refund.id,
      status: "SKIPPED",
      source: "scheduled-scan",
      razorpayRefundId: refund.razorpayRefundId,
      razorpayPaymentId: refund.razorpayPaymentId,
      message: "Max reconciliation attempts reached",
    });
    return null;
  }

  try {
    const razorpayRefund = await fetchRazorpayRefund({
      razorpayRefundId: refund.razorpayRefundId,
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
      razorpayStatus: razorpayRefund.status,
      source: "scheduled-scan",
      payload: razorpayRefund,
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
      razorpayRefundId: refund.razorpayRefundId,
      razorpayPaymentId: refund.razorpayPaymentId,
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
