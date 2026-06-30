import { BillingPlan, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit.service";
import { createCompanyNotification } from "@/server/services/company-notification.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";
import { autoSendCreditNoteEmail } from "@/server/services/billing-document-email.service";
import {
  createCashfreeRefund,
  type CashfreeRefundResponse,
} from "@/server/services/cashfree-payment.service";

export class BillingRefundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingRefundError";
  }
}

function isEnabled() {
  return process.env.BILLING_REFUNDS_ENABLED !== "false";
}

function dryRun() {
  return process.env.BILLING_REFUNDS_DRY_RUN === "true";
}

function requireConfirmation() {
  return process.env.BILLING_REFUNDS_REQUIRE_CONFIRMATION !== "false";
}

function confirmationText() {
  return process.env.BILLING_REFUNDS_CONFIRMATION_TEXT || "CONFIRM_REFUND";
}

function allowPartial() {
  return process.env.BILLING_REFUNDS_ALLOW_PARTIAL !== "false";
}

function autoDowngradeOnFullRefund() {
  return process.env.BILLING_REFUNDS_AUTO_DOWNGRADE_ON_FULL_REFUND !== "false";
}

function defaultDowngradePlan(): BillingPlan {
  return (process.env.BILLING_REFUNDS_DEFAULT_DOWNGRADE_PLAN as BillingPlan) || "FREE";
}

function freeMonthlyMessageLimit() {
  const value = Number(process.env.BILLING_REFUNDS_FREE_MONTHLY_MESSAGE_LIMIT ?? 100);
  return Number.isFinite(value) && value >= 0 ? value : 100;
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

async function nextCreditNoteNumber() {
  const year = new Date().getFullYear();

  const count = await prisma.billingCreditNote.count({
    where: {
      createdAt: {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      },
    },
  });

  return `CN-${year}-${String(count + 1).padStart(6, "0")}`;
}

async function createProviderRefund({
  amountPaise,
  orderId,
  refundId,
  reason,
}: {
  amountPaise: number;
  orderId: string;
  refundId: string;
  reason?: string | null;
}): Promise<CashfreeRefundResponse> {
  if (dryRun()) {
    return {
      cf_refund_id: `dry_refund_${Date.now()}`,
      refund_id: refundId,
      order_id: orderId,
      refund_amount: amountPaise / 100,
      refund_status: "SUCCESS",
      refund_note: reason ?? "dry-run",
    };
  }

  return createCashfreeRefund({
    orderId,
    refundId,
    amountPaise,
    note: reason,
  });
}

function isCashfreeRefundProcessed(refund: CashfreeRefundResponse) {
  return ["SUCCESS", "PROCESSED"].includes(
    String(refund.refund_status ?? "").toUpperCase(),
  );
}

export async function getRefundableInvoiceState({
  companyId,
  invoiceId,
}: {
  companyId: string;
  invoiceId: string;
}) {
  const invoice = await prisma.billingInvoice.findFirst({
    where: {
      id: invoiceId,
      companyId,
    },
    include: {
      refunds: true,
      lines: true,
    },
  });

  if (!invoice) {
    throw new BillingRefundError("Invoice not found.");
  }

  const refundedPaise = invoice.refunds
    .filter((refund) => ["REQUESTED", "PROCESSING", "PROCESSED"].includes(refund.status))
    .reduce((sum, refund) => sum + refund.amountPaise, 0);

  return {
    invoice,
    refundedPaise,
    refundablePaise: Math.max(invoice.totalPaise - refundedPaise, 0),
  };
}

export async function createBillingRefund({
  companyId,
  invoiceId,
  requestedByUserId,
  amountPaise,
  reason,
  confirmation,
  downgradeAfterFullRefund = true,
}: {
  companyId: string;
  invoiceId: string;
  requestedByUserId: string;
  amountPaise: number;
  reason?: string | null;
  confirmation?: string | null;
  downgradeAfterFullRefund?: boolean;
}) {
  if (!isEnabled()) {
    throw new BillingRefundError("Billing refunds are disabled.");
  }

  if (requireConfirmation() && confirmation !== confirmationText()) {
    throw new BillingRefundError(`Confirmation text must be ${confirmationText()}.`);
  }

  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    throw new BillingRefundError("Refund amount must be a positive integer in paise.");
  }

  const state = await getRefundableInvoiceState({
    companyId,
    invoiceId,
  });

  const { invoice, refundablePaise } = state;

  if (!invoice.cashfreeOrderId) {
    throw new BillingRefundError("Invoice does not have a Cashfree order ID.");
  }

  if (amountPaise > refundablePaise) {
    throw new BillingRefundError("Refund amount is greater than refundable amount.");
  }

  if (amountPaise < invoice.totalPaise && !allowPartial()) {
    throw new BillingRefundError("Partial refunds are disabled.");
  }

  const refundType = amountPaise === refundablePaise ? "FULL" : "PARTIAL";

  const refund = await prisma.billingRefund.create({
    data: {
      companyId,
      invoiceId: invoice.id,
      checkoutId: invoice.planCheckoutId,
      requestedByUserId,
      type: refundType,
      source: "ADMIN",
      status: "PROCESSING",
      amountPaise,
      currency: invoice.currency,
      reason: reason ?? null,
      confirmationText: requireConfirmation() ? confirmationText() : null,
      cashfreePaymentId: invoice.cashfreePaymentId,
      metadata: safeJson({
        invoiceNumber: invoice.invoiceNumber,
        invoiceTotalPaise: invoice.totalPaise,
        refundablePaise,
      }),
    },
  });

  try {
    const cashfreeRefund = await createProviderRefund({
      orderId: invoice.cashfreeOrderId,
      amountPaise,
      refundId: refund.id,
      reason,
    });

    const processed = isCashfreeRefundProcessed(cashfreeRefund);

    const result = await prisma.$transaction(async (tx) => {
      const updatedRefund = await tx.billingRefund.update({
        where: {
          id: refund.id,
        },
        data: {
          status: processed ? "PROCESSED" : "PROCESSING",
          cashfreeRefundId: cashfreeRefund.refund_id ?? refund.id,
          cashfreeStatus: cashfreeRefund.refund_status,
          processedAt: processed ? new Date() : null,
          metadata: safeJson({
            cashfreeRefund,
          }),
        },
      });

      const creditNote = await tx.billingCreditNote.create({
        data: {
          companyId,
          refundId: refund.id,
          invoiceId: invoice.id,
          creditNoteNumber: await nextCreditNoteNumber(),
          status: "ISSUED",
          currency: invoice.currency,
          subtotalPaise: amountPaise,
          taxPaise: 0,
          totalPaise: amountPaise,
          reason: reason ?? "billing-refund",
          metadata: safeJson({
            invoiceNumber: invoice.invoiceNumber,
            cashfreeRefundId: cashfreeRefund.refund_id ?? refund.id,
            cashfreeProviderRefundId: cashfreeRefund.cf_refund_id,
          }),
        },
      });

      let planChangeId: string | null = null;

      if (
        refundType === "FULL" &&
        autoDowngradeOnFullRefund() &&
        downgradeAfterFullRefund
      ) {
        const company = await tx.company.findUnique({
          where: {
            id: companyId,
          },
        });

        if (company && company.billingPlan !== defaultDowngradePlan()) {
          const planChange = await tx.companyPlanChange.create({
            data: {
              companyId,
              actorUserId: requestedByUserId,
              fromPlan: company.billingPlan,
              toPlan: defaultDowngradePlan(),
              source: "ADMIN_OVERRIDE",
              checkoutId: invoice.planCheckoutId,
              previousMonthlyMessageLimit: company.monthlyMessageLimit,
              newMonthlyMessageLimit: freeMonthlyMessageLimit(),
              reason: "full-refund-auto-downgrade",
              metadata: safeJson({
                refundId: refund.id,
                invoiceId: invoice.id,
              }),
            },
          });

          planChangeId = planChange.id;

          await tx.company.update({
            where: {
              id: companyId,
            },
            data: {
              billingPlan: defaultDowngradePlan(),
              subscriptionStatus: "ACTIVE",
              monthlyMessageLimit: freeMonthlyMessageLimit(),
              currentPeriodStart: new Date(),
              currentPeriodEnd: addDays(new Date(), 30),
              cancelAtPeriodEnd: false,
              subscriptionCanceledAt: null,
            },
          });

          await tx.billingRefund.update({
            where: {
              id: refund.id,
            },
            data: {
              downgradeApplied: true,
              planChangeId,
            },
          });
        }
      }

      return {
        refund: updatedRefund,
        creditNote,
        planChangeId,
      };
    });

    await createAuditLog({
      companyId,
      actorUserId: requestedByUserId,
      action: "billing.refund_created",
      entityType: "BillingRefund",
      entityId: refund.id,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amountPaise,
        refundType,
        cashfreeRefundId: cashfreeRefund.refund_id ?? refund.id,
        cashfreeProviderRefundId: cashfreeRefund.cf_refund_id,
        planChangeId: result.planChangeId,
      },
    }).catch(() => undefined);

    await autoSendCreditNoteEmail({
      companyId,
      creditNoteId: result.creditNote.id,
    }).catch(() => undefined);

    await createCompanyNotification({
      companyId,
      type: "BILLING",
      severity: "INFO",
      title: "Refund processed",
      message: `A refund of ₹${(amountPaise / 100).toLocaleString("en-IN")} has been processed.`,
      actionHref: "/dashboard/billing/refunds",
      idempotencyKey: `billing-refund:${refund.id}`,
      metadata: {
        refundId: refund.id,
        invoiceId: invoice.id,
        creditNoteId: result.creditNote.id,
      },
    }).catch(() => undefined);

    return result;
  } catch (error) {
    await prisma.billingRefund.update({
      where: {
        id: refund.id,
      },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        failureReason: error instanceof Error ? error.message : "Unknown refund error",
      },
    });

    await createAuditLog({
      companyId,
      actorUserId: requestedByUserId,
      action: "billing.refund_failed",
      entityType: "BillingRefund",
      entityId: refund.id,
      metadata: {
        invoiceId,
        amountPaise,
        error: error instanceof Error ? error.message : "Unknown refund error",
      },
    }).catch(() => undefined);

    throw error;
  }
}

export async function listCompanyBillingRefunds({
  companyId,
}: {
  companyId: string;
}) {
  return prisma.billingRefund.findMany({
    where: {
      companyId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
    include: {
      invoice: true,
      creditNote: true,
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

export async function getBillingRefundHealth() {
  const [processing, processed24h, failed24h, creditNotes24h] = await Promise.all([
    prisma.billingRefund.count({
      where: {
        status: "PROCESSING",
      },
    }),
    prisma.billingRefund.count({
      where: {
        status: "PROCESSED",
        processedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.billingRefund.count({
      where: {
        status: "FAILED",
        failedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.billingCreditNote.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  return {
    enabled: isEnabled(),
    dryRun: dryRun(),
    processing,
    processed24h,
    failed24h,
    creditNotes24h,
    isHealthy: isEnabled() && failed24h === 0,
  };
}
