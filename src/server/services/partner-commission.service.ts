import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createPlatformAuditLog } from "@/server/services/platform-audit.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";
import type {
  ApprovePartnerPayoutInput,
  CreatePartnerCommissionRuleInput,
  RequestPartnerPayoutInput,
  ReversePartnerCommissionInput,
  UpdatePartnerPayoutPaymentInput,
} from "@/server/validators/partner-commission.validator";

export class PartnerCommissionError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PartnerCommissionError";
    this.status = status;
  }
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function assertAmount(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new PartnerCommissionError(`${label} is invalid.`);
  }
}

export function calculatePartnerCommission({
  fixedAmountPaise = 0,
  grossAmountPaise,
  percentageBps = 0,
}: {
  grossAmountPaise: number;
  percentageBps?: number | null;
  fixedAmountPaise?: number | null;
}) {
  assertAmount(grossAmountPaise, "Gross amount");
  assertAmount(percentageBps ?? 0, "Commission percentage");
  assertAmount(fixedAmountPaise ?? 0, "Fixed commission amount");

  if ((percentageBps ?? 0) > 10_000) {
    throw new PartnerCommissionError("Commission percentage cannot exceed 100%.");
  }

  return (
    Math.round((grossAmountPaise * (percentageBps ?? 0)) / 10_000) +
    (fixedAmountPaise ?? 0)
  );
}

async function recordPayoutEvent({
  actorUserId,
  message,
  metadata,
  newValues,
  partnerCompanyId,
  payoutId,
  previousValues,
  type,
}: {
  payoutId: string;
  partnerCompanyId: string;
  actorUserId?: string | null;
  type:
    | "REQUESTED"
    | "APPROVED"
    | "REJECTED"
    | "PROCESSING_STARTED"
    | "MARKED_PAID"
    | "MARKED_FAILED"
    | "CANCELED"
    | "RECONCILED";
  previousValues?: unknown;
  newValues?: unknown;
  message?: string | null;
  metadata?: unknown;
}) {
  await prisma.partnerPayoutEvent.create({
    data: {
      payoutId,
      partnerCompanyId,
      actorUserId: actorUserId ?? null,
      type,
      previousValues: previousValues ? safeJson(previousValues) : undefined,
      newValues: newValues ? safeJson(newValues) : undefined,
      message: message ?? null,
      metadata: metadata ? safeJson(metadata) : undefined,
    },
  });
}

async function availableBalanceForPartner(partnerCompanyId: string) {
  const aggregate = await prisma.partnerCommissionAccrual.aggregate({
    _sum: {
      commissionAmountPaise: true,
    },
    where: {
      partnerCompanyId,
      status: "AVAILABLE",
    },
  });

  return aggregate._sum.commissionAmountPaise ?? 0;
}

export async function getPartnerCommissionDashboard() {
  const [rules, accruals, payouts, partners, pendingHold, available, paid] =
    await Promise.all([
      prisma.partnerCommissionRule.findMany({
        include: {
          partnerCompany: {
            select: {
              id: true,
              name: true,
              type: true,
              status: true,
            },
          },
        },
        orderBy: [{ active: "desc" }, { createdAt: "desc" }],
        take: 50,
      }),
      prisma.partnerCommissionAccrual.findMany({
        include: {
          partnerCompany: { select: { id: true, name: true } },
          clientCompany: { select: { id: true, name: true } },
          subscription: { select: { id: true, platformPlanCode: true } },
          partnerBillingInvoice: {
            select: {
              id: true,
              direction: true,
              totalPaise: true,
              paymentStatus: true,
              billingInvoice: {
                select: {
                  invoiceNumber: true,
                },
              },
            },
          },
          payout: { select: { id: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.partnerPayout.findMany({
        include: {
          partnerCompany: { select: { id: true, name: true } },
          accruals: {
            select: {
              id: true,
              commissionAmountPaise: true,
              status: true,
            },
          },
          events: {
            orderBy: { createdAt: "desc" },
            take: 3,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.company.findMany({
        where: {
          type: "PARTNER",
        },
        select: {
          id: true,
          name: true,
          status: true,
        },
        orderBy: { name: "asc" },
        take: 200,
      }),
      prisma.partnerCommissionAccrual.aggregate({
        _sum: { commissionAmountPaise: true },
        where: { status: "PENDING_HOLD" },
      }),
      prisma.partnerCommissionAccrual.aggregate({
        _sum: { commissionAmountPaise: true },
        where: { status: "AVAILABLE" },
      }),
      prisma.partnerCommissionAccrual.aggregate({
        _sum: { commissionAmountPaise: true },
        where: { status: "PAID" },
      }),
    ]);

  return {
    rules,
    accruals,
    payouts,
    partners,
    totals: {
      pendingHoldPaise: pendingHold._sum.commissionAmountPaise ?? 0,
      availablePaise: available._sum.commissionAmountPaise ?? 0,
      paidPaise: paid._sum.commissionAmountPaise ?? 0,
    },
  };
}

export async function createPartnerCommissionRule({
  actorUserId,
  input,
}: {
  actorUserId?: string | null;
  input: CreatePartnerCommissionRuleInput;
}) {
  const partner = await prisma.company.findUnique({
    where: { id: input.partnerCompanyId },
    select: { id: true, name: true, type: true },
  });

  if (!partner || partner.type !== "PARTNER") {
    throw new PartnerCommissionError("Partner company not found.", 404);
  }

  const startsAt = input.startsAt ?? new Date();

  const rule = await prisma.$transaction(async (tx) => {
    await tx.partnerCommissionRule.updateMany({
      where: {
        partnerCompanyId: partner.id,
        planCode: input.planCode ?? null,
        active: true,
      },
      data: {
        active: false,
        endsAt: startsAt,
      },
    });

    return tx.partnerCommissionRule.create({
      data: {
        partnerCompanyId: partner.id,
        planCode: input.planCode ?? null,
        percentageBps: input.percentageBps ?? null,
        fixedAmountPaise: input.fixedAmountPaise ?? null,
        holdDays: input.holdDays,
        startsAt,
        endsAt: input.endsAt ?? null,
        metadata: safeJson({
          source: "platform_commission_rule",
        }),
      },
    });
  });

  await createPlatformAuditLog({
    actorUserId,
    action: "partner_commission_rule.created",
    entityType: "PartnerCommissionRule",
    entityId: rule.id,
    metadata: {
      partnerCompanyId: partner.id,
      planCode: rule.planCode,
      percentageBps: rule.percentageBps,
      fixedAmountPaise: rule.fixedAmountPaise,
      holdDays: rule.holdDays,
    },
  });

  return rule;
}

export async function accrueCommissionForPartnerInvoice({
  actorUserId,
  partnerBillingInvoiceId,
}: {
  actorUserId?: string | null;
  partnerBillingInvoiceId: string;
}) {
  const invoice = await prisma.partnerBillingInvoice.findUnique({
    where: { id: partnerBillingInvoiceId },
    include: {
      subscription: true,
    },
  });

  if (!invoice || !invoice.subscription) {
    throw new PartnerCommissionError("Partner invoice not found.", 404);
  }

  if (invoice.paymentStatus !== "PAID") {
    throw new PartnerCommissionError("Only paid invoices can create commissions.");
  }

  if (invoice.subscription.billingOwnerType !== "SELF") {
    throw new PartnerCommissionError(
      "Only referral/self-billed subscriptions earn commission. Reseller clients earn margin instead.",
    );
  }

  const asOf = invoice.paidAt ?? new Date();
  const rules = await prisma.partnerCommissionRule.findMany({
    where: {
      partnerCompanyId: invoice.partnerCompanyId,
      active: true,
      startsAt: { lte: asOf },
      AND: [
        {
          OR: [{ endsAt: null }, { endsAt: { gt: asOf } }],
        },
        {
          OR: [
            { planCode: invoice.subscription.platformPlanCode },
            { planCode: null },
          ],
        },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
  const rule =
    rules.find(
      (candidate) =>
        candidate.planCode === invoice.subscription?.platformPlanCode,
    ) ??
    rules[0];

  if (!rule) {
    throw new PartnerCommissionError("No active commission rule exists for this partner.");
  }

  const commissionAmountPaise = calculatePartnerCommission({
    grossAmountPaise: invoice.totalPaise,
    percentageBps: rule.percentageBps,
    fixedAmountPaise: rule.fixedAmountPaise,
  });

  if (commissionAmountPaise <= 0) {
    throw new PartnerCommissionError("Calculated commission is zero.");
  }

  const idempotencyKey = `partner-commission:${invoice.id}`;
  const accrual = await prisma.partnerCommissionAccrual.upsert({
    where: { idempotencyKey },
    update: {},
    create: {
      partnerCompanyId: invoice.partnerCompanyId,
      clientCompanyId: invoice.clientCompanyId,
      subscriptionId: invoice.subscriptionId,
      partnerBillingInvoiceId: invoice.id,
      grossAmountPaise: invoice.totalPaise,
      commissionAmountPaise,
      currency: invoice.currency,
      holdDays: rule.holdDays,
      availableAt: addDays(asOf, rule.holdDays),
      idempotencyKey,
      metadata: safeJson({
        ruleId: rule.id,
        percentageBps: rule.percentageBps,
        fixedAmountPaise: rule.fixedAmountPaise,
        invoicePaymentStatus: invoice.paymentStatus,
      }),
    },
  });

  await createPlatformAuditLog({
    actorUserId,
    action: "partner_commission.accrued",
    entityType: "PartnerCommissionAccrual",
    entityId: accrual.id,
    metadata: {
      partnerCompanyId: invoice.partnerCompanyId,
      clientCompanyId: invoice.clientCompanyId,
      partnerBillingInvoiceId: invoice.id,
      commissionAmountPaise,
    },
  });

  return accrual;
}

export async function reversePartnerCommissionAccrual({
  actorUserId,
  input,
}: {
  actorUserId?: string | null;
  input: ReversePartnerCommissionInput;
}) {
  const accrual = await prisma.partnerCommissionAccrual.findUnique({
    where: { id: input.accrualId },
  });

  if (!accrual) {
    throw new PartnerCommissionError("Commission accrual not found.", 404);
  }

  if (accrual.type === "REVERSAL" || accrual.commissionAmountPaise < 0) {
    throw new PartnerCommissionError("Reversal records cannot be reversed again.");
  }

  if (["INCLUDED_IN_PAYOUT", "PAID"].includes(accrual.status)) {
    throw new PartnerCommissionError("Paid or payout-included commissions need a payout adjustment.");
  }

  const existing = await prisma.partnerCommissionAccrual.findFirst({
    where: {
      reversalOfAccrualId: accrual.id,
      type: "REVERSAL",
    },
  });

  if (existing) {
    return existing;
  }

  const reversal = await prisma.$transaction(async (tx) => {
    const created = await tx.partnerCommissionAccrual.create({
      data: {
        partnerCompanyId: accrual.partnerCompanyId,
        clientCompanyId: accrual.clientCompanyId,
        subscriptionId: accrual.subscriptionId,
        partnerBillingInvoiceId: accrual.partnerBillingInvoiceId,
        type: "REVERSAL",
        status: "AVAILABLE",
        grossAmountPaise: accrual.grossAmountPaise * -1,
        commissionAmountPaise: accrual.commissionAmountPaise * -1,
        currency: accrual.currency,
        holdDays: 0,
        availableAt: new Date(),
        reversalOfAccrualId: accrual.id,
        idempotencyKey: `partner-commission-reversal:${accrual.id}`,
        source: "partner_commission_reversal",
        metadata: safeJson({
          reason: input.reason,
        }),
      },
    });

    await tx.partnerCommissionAccrual.update({
      where: { id: accrual.id },
      data: {
        status: "REVERSED",
      },
    });

    return created;
  });

  await createPlatformAuditLog({
    actorUserId,
    action: "partner_commission.reversed",
    entityType: "PartnerCommissionAccrual",
    entityId: reversal.id,
    metadata: {
      originalAccrualId: accrual.id,
      reason: input.reason,
    },
  });

  return reversal;
}

export async function markPartnerCommissionsAvailable({
  actorUserId,
  asOf = new Date(),
}: {
  actorUserId?: string | null;
  asOf?: Date;
}) {
  const result = await prisma.partnerCommissionAccrual.updateMany({
    where: {
      status: "PENDING_HOLD",
      availableAt: { lte: asOf },
    },
    data: {
      status: "AVAILABLE",
    },
  });

  await createPlatformAuditLog({
    actorUserId,
    action: "partner_commission.mark_available",
    entityType: "PartnerCommissionAccrual",
    metadata: {
      count: result.count,
      asOf,
    },
  });

  return result;
}

export async function requestPartnerPayout({
  actorUserId,
  input,
}: {
  actorUserId?: string | null;
  input: RequestPartnerPayoutInput;
}) {
  const availableBalance = await availableBalanceForPartner(input.partnerCompanyId);

  if (availableBalance <= 0) {
    throw new PartnerCommissionError("This partner has no available commission balance.");
  }

  if (input.amountPaise !== availableBalance) {
    throw new PartnerCommissionError(
      "For now, payout requests must match the full available balance.",
    );
  }

  const payout = await prisma.$transaction(async (tx) => {
    const created = await tx.partnerPayout.create({
      data: {
        partnerCompanyId: input.partnerCompanyId,
        amountPaise: input.amountPaise,
        notes: input.notes ?? null,
        metadata: safeJson({
          source: "platform_partner_payout",
        }),
      },
    });

    await tx.partnerCommissionAccrual.updateMany({
      where: {
        partnerCompanyId: input.partnerCompanyId,
        status: "AVAILABLE",
      },
      data: {
        status: "INCLUDED_IN_PAYOUT",
        payoutId: created.id,
      },
    });

    await tx.partnerPayoutEvent.create({
      data: {
        payoutId: created.id,
        partnerCompanyId: input.partnerCompanyId,
        actorUserId: actorUserId ?? null,
        type: "REQUESTED",
        newValues: safeJson({
          amountPaise: input.amountPaise,
          notes: input.notes ?? null,
        }),
      },
    });

    return created;
  });

  await createPlatformAuditLog({
    actorUserId,
    action: "partner_payout.requested",
    entityType: "PartnerPayout",
    entityId: payout.id,
    metadata: {
      partnerCompanyId: input.partnerCompanyId,
      amountPaise: input.amountPaise,
    },
  });

  return payout;
}

export async function approvePartnerPayout({
  actorUserId,
  input,
  payoutId,
}: {
  actorUserId?: string | null;
  payoutId: string;
  input: ApprovePartnerPayoutInput;
}) {
  const payout = await prisma.partnerPayout.findUnique({
    where: { id: payoutId },
  });

  if (!payout) {
    throw new PartnerCommissionError("Payout not found.", 404);
  }

  if (payout.status !== "REQUESTED") {
    throw new PartnerCommissionError("Only requested payouts can be approved.");
  }

  const updated = await prisma.partnerPayout.update({
    where: { id: payout.id },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedByUserId: actorUserId ?? null,
      notes: input.note ?? payout.notes,
    },
  });

  await recordPayoutEvent({
    payoutId: payout.id,
    partnerCompanyId: payout.partnerCompanyId,
    actorUserId,
    type: "APPROVED",
    previousValues: { status: payout.status },
    newValues: { status: updated.status, note: input.note },
  });

  await createPlatformAuditLog({
    actorUserId,
    action: "partner_payout.approved",
    entityType: "PartnerPayout",
    entityId: payout.id,
    metadata: {
      partnerCompanyId: payout.partnerCompanyId,
      amountPaise: payout.amountPaise,
    },
  });

  return updated;
}

export async function updatePartnerPayoutPayment({
  actorUserId,
  input,
  payoutId,
}: {
  actorUserId?: string | null;
  payoutId: string;
  input: UpdatePartnerPayoutPaymentInput;
}) {
  const payout = await prisma.partnerPayout.findUnique({
    where: { id: payoutId },
  });

  if (!payout) {
    throw new PartnerCommissionError("Payout not found.", 404);
  }

  if (!["APPROVED", "PROCESSING"].includes(payout.status)) {
    throw new PartnerCommissionError("Only approved payouts can be paid or failed.");
  }

  const now = new Date();
  const eventType =
    input.status === "PAID"
      ? "MARKED_PAID"
      : input.status === "FAILED"
        ? "MARKED_FAILED"
        : "CANCELED";

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.partnerPayout.update({
      where: { id: payout.id },
      data: {
        status: input.status,
        paidAt: input.status === "PAID" ? now : payout.paidAt,
        failedAt: input.status === "FAILED" ? now : payout.failedAt,
        canceledAt: input.status === "CANCELED" ? now : payout.canceledAt,
        processedByUserId: actorUserId ?? null,
        bankReference: input.bankReference ?? payout.bankReference,
        failureReason: input.failureReason ?? null,
        notes: input.note ?? payout.notes,
      },
    });

    if (input.status === "PAID") {
      await tx.partnerCommissionAccrual.updateMany({
        where: { payoutId: payout.id },
        data: {
          status: "PAID",
          paidAt: now,
        },
      });
    } else {
      await tx.partnerCommissionAccrual.updateMany({
        where: { payoutId: payout.id, status: "INCLUDED_IN_PAYOUT" },
        data: {
          status: "AVAILABLE",
          payoutId: null,
        },
      });
    }

    await tx.partnerPayoutEvent.create({
      data: {
        payoutId: payout.id,
        partnerCompanyId: payout.partnerCompanyId,
        actorUserId: actorUserId ?? null,
        type: eventType,
        previousValues: safeJson({ status: payout.status }),
        newValues: safeJson({
          status: input.status,
          bankReference: input.bankReference,
          failureReason: input.failureReason,
          note: input.note,
        }),
      },
    });

    return next;
  });

  await createPlatformAuditLog({
    actorUserId,
    action: `partner_payout.${input.status.toLowerCase()}`,
    entityType: "PartnerPayout",
    entityId: payout.id,
    metadata: {
      partnerCompanyId: payout.partnerCompanyId,
      amountPaise: payout.amountPaise,
      bankReference: input.bankReference,
      failureReason: input.failureReason,
    },
  });

  return updated;
}
