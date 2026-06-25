import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit.service";
import { createCompanyNotification } from "@/server/services/company-notification.service";
import {
  getPlanMonthlyMessageLimit,
} from "@/server/services/plan-upgrade.service";
import { createPaidPlanUpgradeInvoice } from "@/server/services/billing-invoice.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";

export class BillingOpsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingOpsError";
  }
}

function isEnabled() {
  return process.env.BILLING_OPS_ENABLED !== "false";
}

function requireConfirmation() {
  return process.env.BILLING_OPS_REQUIRE_CONFIRMATION !== "false";
}

function confirmationText() {
  return process.env.BILLING_OPS_CONFIRMATION_TEXT || "CONFIRM_PAYMENT_REVIEW";
}

function maxReviewAgeHours() {
  const value = Number(process.env.BILLING_OPS_MAX_PENDING_REVIEW_AGE_HOURS ?? 72);
  return Number.isFinite(value) && value > 0 ? value : 72;
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function assertBillingOpsEnabled() {
  if (!isEnabled()) {
    throw new BillingOpsError("Billing Ops is disabled.");
  }
}

export async function listManualReviewCheckouts({
  companyId,
}: {
  companyId?: string | null;
}) {
  return prisma.planCheckout.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      status: "MANUAL_REVIEW",
    },
    orderBy: {
      manualReviewOpenedAt: "asc",
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          billingPlan: true,
          subscriptionStatus: true,
        },
      },
      requestedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      reconciliationEvents: {
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
      },
    },
  });
}

export async function listRecentPlanCheckouts({
  companyId,
  take = 50,
}: {
  companyId?: string | null;
  take?: number;
}) {
  return prisma.planCheckout.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    take,
    include: {
      company: {
        select: {
          id: true,
          name: true,
          billingPlan: true,
          subscriptionStatus: true,
        },
      },
      requestedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

export async function approveManualPlanCheckout({
  checkoutId,
  reviewedByUserId,
  confirmation,
  notes,
}: {
  checkoutId: string;
  reviewedByUserId: string;
  confirmation?: string | null;
  notes?: string | null;
}) {
  assertBillingOpsEnabled();

  if (requireConfirmation() && confirmation !== confirmationText()) {
    throw new BillingOpsError(`Confirmation text must be ${confirmationText()}.`);
  }

  const checkout = await prisma.planCheckout.findUnique({
    where: {
      id: checkoutId,
    },
    include: {
      company: true,
    },
  });

  if (!checkout) {
    throw new BillingOpsError("Checkout not found.");
  }

  if (checkout.status !== "MANUAL_REVIEW") {
    throw new BillingOpsError(`Checkout is ${checkout.status}, not MANUAL_REVIEW.`);
  }

  if (!checkout.razorpayOrderId || !checkout.razorpayPaymentId) {
    throw new BillingOpsError("Checkout is missing Razorpay payment reference.");
  }

  const newMonthlyMessageLimit = getPlanMonthlyMessageLimit(checkout.toPlan);

  const result = await prisma.$transaction(async (tx) => {
    const updatedCheckout = await tx.planCheckout.update({
      where: {
        id: checkout.id,
      },
      data: {
        status: "PAID",
        paidAt: new Date(),
        manualReviewedAt: new Date(),
        manualReviewedByUserId: reviewedByUserId,
        manualReviewDecision: "APPROVED",
        manualReviewNotes: notes ?? null,
        lastReconciliationError: null,
      },
    });

    const previousMonthlyMessageLimit = checkout.company.monthlyMessageLimit;

    await tx.company.update({
      where: {
        id: checkout.companyId,
      },
      data: {
        billingPlan: checkout.toPlan,
        subscriptionStatus: "ACTIVE",
        monthlyMessageLimit: newMonthlyMessageLimit,
        currentPeriodStart: new Date(),
        currentPeriodEnd: addDays(new Date(), 30),
        cancelAtPeriodEnd: false,
        subscriptionCanceledAt: null,
      },
    });

    const planChange = await tx.companyPlanChange.create({
      data: {
        companyId: checkout.companyId,
        actorUserId: reviewedByUserId,
        fromPlan: checkout.fromPlan,
        toPlan: checkout.toPlan,
        source: "ADMIN_OVERRIDE",
        checkoutId: checkout.id,
        previousMonthlyMessageLimit,
        newMonthlyMessageLimit,
        reason: "manual-payment-review-approved",
        metadata: safeJson({
          razorpayOrderId: checkout.razorpayOrderId,
          razorpayPaymentId: checkout.razorpayPaymentId,
          notes,
        }),
      },
    });

    await tx.planCheckoutReconciliationEvent.create({
      data: {
        companyId: checkout.companyId,
        checkoutId: checkout.id,
        status: "COMPLETED",
        source: "manual-review",
        razorpayOrderId: checkout.razorpayOrderId,
        razorpayPaymentId: checkout.razorpayPaymentId,
        message: "Manual payment review approved by admin.",
        metadata: safeJson({
          reviewedByUserId,
          notes,
          planChangeId: planChange.id,
        }),
      },
    });

    return {
      checkout: updatedCheckout,
      planChange,
    };
  });

  await createPaidPlanUpgradeInvoice({
    companyId: checkout.companyId,
    userId: reviewedByUserId,
    planCheckoutId: checkout.id,
    planChangeId: result.planChange.id,
    toPlan: checkout.toPlan,
    amountPaise: checkout.amountPaise,
    currency: checkout.currency,
    razorpayOrderId: checkout.razorpayOrderId,
    razorpayPaymentId: checkout.razorpayPaymentId,
  }).catch(() => undefined);

  await createAuditLog({
    companyId: checkout.companyId,
    actorUserId: reviewedByUserId,
    action: "billing.manual_payment_review_approved",
    entityType: "PlanCheckout",
    entityId: checkout.id,
    metadata: {
      fromPlan: checkout.fromPlan,
      toPlan: checkout.toPlan,
      razorpayOrderId: checkout.razorpayOrderId,
      razorpayPaymentId: checkout.razorpayPaymentId,
      planChangeId: result.planChange.id,
      notes,
    },
  }).catch(() => undefined);

  await createCompanyNotification({
    companyId: checkout.companyId,
    type: "BILLING",
    severity: "SUCCESS",
    title: "Payment approved",
    message: `Your ${checkout.toPlan} plan payment has been approved and your plan is now active.`,
    actionHref: "/dashboard/billing",
    idempotencyKey: `manual-payment-approved:${checkout.id}`,
    metadata: {
      checkoutId: checkout.id,
      planChangeId: result.planChange.id,
    },
  }).catch(() => undefined);

  return result;
}

export async function rejectManualPlanCheckout({
  checkoutId,
  reviewedByUserId,
  confirmation,
  notes,
}: {
  checkoutId: string;
  reviewedByUserId: string;
  confirmation?: string | null;
  notes?: string | null;
}) {
  assertBillingOpsEnabled();

  if (requireConfirmation() && confirmation !== confirmationText()) {
    throw new BillingOpsError(`Confirmation text must be ${confirmationText()}.`);
  }

  const checkout = await prisma.planCheckout.findUnique({
    where: {
      id: checkoutId,
    },
  });

  if (!checkout) {
    throw new BillingOpsError("Checkout not found.");
  }

  if (checkout.status !== "MANUAL_REVIEW") {
    throw new BillingOpsError(`Checkout is ${checkout.status}, not MANUAL_REVIEW.`);
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedCheckout = await tx.planCheckout.update({
      where: {
        id: checkout.id,
      },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        failureReason: "Manual payment review rejected",
        manualReviewedAt: new Date(),
        manualReviewedByUserId: reviewedByUserId,
        manualReviewDecision: "REJECTED",
        manualReviewNotes: notes ?? null,
      },
    });

    await tx.planCheckoutReconciliationEvent.create({
      data: {
        companyId: checkout.companyId,
        checkoutId: checkout.id,
        status: "FAILED",
        source: "manual-review",
        razorpayOrderId: checkout.razorpayOrderId,
        razorpayPaymentId: checkout.razorpayPaymentId,
        message: "Manual payment review rejected by admin.",
        errorMessage: notes ?? null,
        metadata: safeJson({
          reviewedByUserId,
          notes,
        }),
      },
    });

    return updatedCheckout;
  });

  await createAuditLog({
    companyId: checkout.companyId,
    actorUserId: reviewedByUserId,
    action: "billing.manual_payment_review_rejected",
    entityType: "PlanCheckout",
    entityId: checkout.id,
    metadata: {
      razorpayOrderId: checkout.razorpayOrderId,
      razorpayPaymentId: checkout.razorpayPaymentId,
      notes,
    },
  }).catch(() => undefined);

  await createCompanyNotification({
    companyId: checkout.companyId,
    type: "BILLING",
    severity: "ERROR",
    title: "Payment review rejected",
    message:
      "Your payment review was rejected. Please contact support or retry checkout.",
    actionHref: "/dashboard/billing/upgrade",
    idempotencyKey: `manual-payment-rejected:${checkout.id}`,
    metadata: {
      checkoutId: checkout.id,
    },
  }).catch(() => undefined);

  return result;
}

export async function expireStaleManualReviews() {
  assertBillingOpsEnabled();

  const cutoff = new Date(Date.now() - maxReviewAgeHours() * 60 * 60 * 1000);

  const stale = await prisma.planCheckout.findMany({
    where: {
      status: "MANUAL_REVIEW",
      manualReviewOpenedAt: {
        lt: cutoff,
      },
    },
    take: 100,
  });

  let expired = 0;

  for (const checkout of stale) {
    await prisma.planCheckout.update({
      where: {
        id: checkout.id,
      },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        failureReason: "Manual review expired",
        manualReviewDecision: "EXPIRED",
        manualReviewedAt: new Date(),
      },
    });

    await prisma.planCheckoutReconciliationEvent.create({
      data: {
        companyId: checkout.companyId,
        checkoutId: checkout.id,
        status: "EXPIRED",
        source: "billing-ops-expiry",
        razorpayOrderId: checkout.razorpayOrderId,
        razorpayPaymentId: checkout.razorpayPaymentId,
        message: "Manual review expired.",
      },
    });

    expired += 1;
  }

  return {
    checked: stale.length,
    expired,
  };
}

export async function getBillingOpsHealth() {
  const [manualReviewOpen, approved24h, rejected24h, staleReviews] =
    await Promise.all([
      prisma.planCheckout.count({
        where: {
          status: "MANUAL_REVIEW",
        },
      }),
      prisma.planCheckout.count({
        where: {
          manualReviewDecision: "APPROVED",
          manualReviewedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.planCheckout.count({
        where: {
          manualReviewDecision: "REJECTED",
          manualReviewedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.planCheckout.count({
        where: {
          status: "MANUAL_REVIEW",
          manualReviewOpenedAt: {
            lt: new Date(Date.now() - maxReviewAgeHours() * 60 * 60 * 1000),
          },
        },
      }),
    ]);

  return {
    enabled: isEnabled(),
    requireConfirmation: requireConfirmation(),
    confirmationText: confirmationText(),
    manualReviewOpen,
    approved24h,
    rejected24h,
    staleReviews,
    maxReviewAgeHours: maxReviewAgeHours(),
    isHealthy: isEnabled() && staleReviews === 0,
  };
}
