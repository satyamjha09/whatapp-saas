import {
  BillingInvoiceStatus,
  CompanyBillingOwnerType,
  PartnerBillingInvoiceDirection,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getInvoiceBillingSnapshot } from "@/server/services/company-billing-profile.service";
import type { BrandContext } from "@/server/branding/brand-context";
import {
  brandSnapshotForBilling,
  resolveBrandContext,
} from "@/server/services/partner-branding.service";
import { createPlatformAuditLog } from "@/server/services/platform-audit.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";
import type {
  GeneratePartnerBillingInvoiceInput,
  UpdatePartnerBillingOwnerInput,
  UpdatePartnerBillingPaymentInput,
} from "@/server/validators/partner-billing.validator";

export class PartnerBillingError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PartnerBillingError";
    this.status = status;
  }
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

function invoicePrefix() {
  return process.env.PARTNER_BILLING_INVOICE_PREFIX || "MWP";
}

function taxBasisPoints() {
  const value = Number(process.env.PARTNER_BILLING_TAX_BASIS_POINTS ?? 0);

  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function defaultDueDays() {
  const value = Number(process.env.PARTNER_BILLING_DUE_DAYS ?? 15);

  return Number.isFinite(value) && value > 0 ? value : 15;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function calculateTax(subtotalPaise: number, basisPoints: number) {
  return Math.round((subtotalPaise * basisPoints) / 10_000);
}

export function calculatePartnerBillingTotals({
  subtotalPaise,
  taxBasisPoints: basisPoints,
}: {
  subtotalPaise: number;
  taxBasisPoints: number;
}) {
  if (!Number.isInteger(subtotalPaise) || subtotalPaise < 0) {
    throw new PartnerBillingError("Subtotal amount is invalid.");
  }

  if (!Number.isInteger(basisPoints) || basisPoints < 0) {
    throw new PartnerBillingError("Tax basis points are invalid.");
  }

  const taxPaise = calculateTax(subtotalPaise, basisPoints);

  return {
    subtotalPaise,
    taxPaise,
    totalPaise: subtotalPaise + taxPaise,
  };
}

function assertDate(value: Date, label: string) {
  if (Number.isNaN(value.getTime())) {
    throw new PartnerBillingError(`${label} is invalid.`);
  }
}

async function nextPartnerInvoiceNumber({
  direction,
}: {
  direction: PartnerBillingInvoiceDirection;
}) {
  const year = new Date().getFullYear();
  const directionPrefix =
    direction === "METAWHAT_TO_PARTNER" ? "WHOLESALE" : "RETAIL";
  const count = await prisma.billingInvoice.count({
    where: {
      createdAt: {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      },
      metadata: {
        path: ["partnerBilling", "direction"],
        equals: direction,
      },
    },
  });

  return `${invoicePrefix()}-${directionPrefix}-${year}-${String(count + 1).padStart(
    6,
    "0",
  )}`;
}

async function recordPartnerBillingEvent({
  actorUserId,
  clientCompanyId,
  message,
  metadata,
  newValues,
  partnerBillingInvoiceId,
  partnerCompanyId,
  previousValues,
  type,
}: {
  partnerBillingInvoiceId: string;
  partnerCompanyId: string;
  clientCompanyId?: string | null;
  actorUserId?: string | null;
  type:
    | "GENERATED"
    | "ISSUED"
    | "PAYMENT_LINK_RECORDED"
    | "PAYMENT_MARKED_PAID"
    | "PAYMENT_MARKED_FAILED"
    | "MARKED_OVERDUE"
    | "VOIDED"
    | "FAILED"
    | "BILLING_OWNER_CHANGED";
  previousValues?: unknown;
  newValues?: unknown;
  message?: string | null;
  metadata?: unknown;
}) {
  await prisma.partnerBillingInvoiceEvent.create({
    data: {
      partnerBillingInvoiceId,
      partnerCompanyId,
      clientCompanyId: clientCompanyId ?? null,
      actorUserId: actorUserId ?? null,
      type,
      previousValues: previousValues ? safeJson(previousValues) : undefined,
      newValues: newValues ? safeJson(newValues) : undefined,
      message: message ?? null,
      metadata: metadata ? safeJson(metadata) : undefined,
    },
  });
}

function sellerSnapshotForDirection({
  brand,
  direction,
  partner,
}: {
  brand: BrandContext;
  direction: PartnerBillingInvoiceDirection;
  partner: { name: string; supportEmail: string | null };
}) {
  if (direction === "PARTNER_TO_CLIENT") {
    return {
      sellerName: brand.source === "partner" ? brand.companyName : partner.name,
      sellerEmail:
        brand.source === "partner"
          ? brand.supportEmail || partner.supportEmail
          : partner.supportEmail,
      sellerAddress: null,
      sellerTaxId: null,
    };
  }

  return {
    sellerName: process.env.BILLING_SELLER_NAME || "metawhat",
    sellerEmail: process.env.BILLING_SELLER_EMAIL || null,
    sellerAddress: process.env.BILLING_SELLER_ADDRESS || null,
    sellerTaxId: process.env.BILLING_SELLER_TAX_ID || null,
  };
}

async function createLinkedPartnerInvoice({
  actorUserId,
  amountPaise,
  billingOwnerType,
  clientCompanyId,
  currency,
  direction,
  dueAt,
  issueImmediately,
  partner,
  periodEnd,
  periodStart,
  subscriptionId,
}: {
  actorUserId: string;
  partner: { id: string; name: string; supportEmail: string | null };
  clientCompanyId: string;
  subscriptionId: string;
  direction: PartnerBillingInvoiceDirection;
  billingOwnerType: CompanyBillingOwnerType;
  amountPaise: number;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  dueAt: Date;
  issueImmediately: boolean;
}) {
  if (!Number.isInteger(amountPaise) || amountPaise < 0) {
    throw new PartnerBillingError("Invoice amount is invalid.");
  }

  const invoiceCompanyId =
    direction === "METAWHAT_TO_PARTNER" ? partner.id : clientCompanyId;
  const billingSnapshot = await getInvoiceBillingSnapshot({
    companyId: invoiceCompanyId,
  });
  const basisPoints = taxBasisPoints();
  const { taxPaise, totalPaise } = calculatePartnerBillingTotals({
    subtotalPaise: amountPaise,
    taxBasisPoints: basisPoints,
  });
  const brand = await resolveBrandContext(invoiceCompanyId);
  const brandSnapshot = brandSnapshotForBilling(brand);
  const seller = sellerSnapshotForDirection({
    brand,
    direction,
    partner,
  });
  const status: BillingInvoiceStatus = issueImmediately ? "ISSUED" : "DRAFT";
  const metadata = {
    source: "partner-billing",
    partnerBilling: {
      direction,
      partnerCompanyId: partner.id,
      clientCompanyId,
      subscriptionId,
      billingOwnerType,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    },
    brandSnapshot,
  };

  const created = await prisma.$transaction(async (tx) => {
    const invoice = await tx.billingInvoice.create({
      data: {
        companyId: invoiceCompanyId,
        userId: actorUserId,
        invoiceNumber: await nextPartnerInvoiceNumber({
          direction,
        }),
        status,
        currency,
        subtotalPaise: amountPaise,
        taxPaise,
        totalPaise,
        taxBasisPoints: basisPoints,
        billingName: billingSnapshot.billingName,
        billingEmail: billingSnapshot.billingEmail,
        billingAddress: billingSnapshot.billingAddress || null,
        billingTaxId: billingSnapshot.billingTaxId,
        sellerName: seller.sellerName,
        sellerEmail: seller.sellerEmail,
        sellerAddress: seller.sellerAddress,
        sellerTaxId: seller.sellerTaxId,
        issuedAt: issueImmediately ? new Date() : null,
        metadata: safeJson(metadata),
        lines: {
          create: [
            {
              type: "PLAN",
              description:
                direction === "METAWHAT_TO_PARTNER"
                  ? "Partner wholesale platform subscription"
                  : "Client retail subscription billed by partner",
              quantity: 1,
              unitAmountPaise: amountPaise,
              totalPaise: amountPaise,
              metadata: safeJson(metadata),
            },
            ...(taxPaise > 0
              ? [
                  {
                    type: "TAX" as const,
                    description: `Tax ${basisPoints / 100}%`,
                    quantity: 1,
                    unitAmountPaise: taxPaise,
                    totalPaise: taxPaise,
                    metadata: safeJson({
                      basisPoints,
                    }),
                  },
                ]
              : []),
          ],
        },
      },
    });

    const partnerInvoice = await tx.partnerBillingInvoice.create({
      data: {
        partnerCompanyId: partner.id,
        clientCompanyId,
        subscriptionId,
        billingInvoiceId: invoice.id,
        direction,
        billingOwnerType,
        status,
        paymentStatus: "AWAITING_PAYMENT",
        periodStart,
        periodEnd,
        dueAt,
        currency,
        subtotalPaise: amountPaise,
        taxPaise,
        totalPaise,
        taxBasisPoints: basisPoints,
        metadata: safeJson(metadata),
      },
      include: {
        billingInvoice: true,
      },
    });

    await tx.partnerBillingInvoiceEvent.create({
      data: {
        partnerBillingInvoiceId: partnerInvoice.id,
        partnerCompanyId: partner.id,
        clientCompanyId,
        actorUserId,
        type: issueImmediately ? "ISSUED" : "GENERATED",
        newValues: safeJson({
          direction,
          status,
          totalPaise,
          dueAt,
        }),
        message: issueImmediately
          ? "Partner billing invoice issued."
          : "Partner billing draft generated.",
      },
    });

    return partnerInvoice;
  });

  await createPlatformAuditLog({
    actorUserId,
    action: "partner_billing.invoice_generated",
    entityType: "PartnerBillingInvoice",
    entityId: created.id,
    metadata: safeJson({
      direction,
      partnerCompanyId: partner.id,
      clientCompanyId,
      subscriptionId,
      billingInvoiceId: created.billingInvoiceId,
      totalPaise,
      status,
    }),
  }).catch(() => undefined);

  return created;
}

export async function getPartnerBillingDashboard() {
  const [invoices, activeSubscriptions, overdueCount] = await Promise.all([
    prisma.partnerBillingInvoice.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
      include: {
        partnerCompany: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        clientCompany: {
          select: {
            id: true,
            name: true,
            status: true,
            billingOwnerType: true,
          },
        },
        subscription: {
          select: {
            id: true,
            platformPlanCode: true,
            status: true,
            billingOwnerType: true,
          },
        },
        billingInvoice: {
          include: {
            lines: true,
            pdfRenders: {
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
            },
          },
        },
        events: {
          orderBy: {
            createdAt: "desc",
          },
          take: 3,
        },
      },
    }),
    prisma.partnerClientSubscription.findMany({
      where: {
        status: {
          in: ["ACTIVE", "TRIALING", "PAST_DUE"],
        },
      },
      orderBy: {
        currentPeriodEnd: "asc",
      },
      take: 100,
      include: {
        partnerCompany: {
          select: {
            id: true,
            name: true,
            supportEmail: true,
          },
        },
        clientCompany: {
          select: {
            id: true,
            name: true,
            billingOwnerType: true,
          },
        },
      },
    }),
    prisma.partnerBillingInvoice.count({
      where: {
        paymentStatus: "OVERDUE",
      },
    }),
  ]);

  const totals = invoices.reduce(
    (acc, invoice) => {
      acc.totalPaise += invoice.totalPaise;
      if (invoice.paymentStatus === "PAID") acc.paidPaise += invoice.totalPaise;
      if (invoice.paymentStatus === "AWAITING_PAYMENT") {
        acc.pendingPaise += invoice.totalPaise;
      }
      if (invoice.paymentStatus === "OVERDUE") {
        acc.overduePaise += invoice.totalPaise;
      }

      return acc;
    },
    {
      totalPaise: 0,
      paidPaise: 0,
      pendingPaise: 0,
      overduePaise: 0,
    },
  );

  return {
    invoices,
    activeSubscriptions,
    overdueCount,
    totals,
  };
}

export async function generatePartnerBillingInvoices({
  actorUserId,
  input,
}: {
  actorUserId: string;
  input: GeneratePartnerBillingInvoiceInput;
}) {
  const subscription = await prisma.partnerClientSubscription.findUnique({
    where: {
      id: input.subscriptionId,
    },
    include: {
      partnerCompany: {
        select: {
          id: true,
          name: true,
          type: true,
          supportEmail: true,
        },
      },
      clientCompany: {
        select: {
          id: true,
          name: true,
          type: true,
          billingOwnerType: true,
        },
      },
    },
  });

  if (!subscription) {
    throw new PartnerBillingError("Partner subscription not found.", 404);
  }

  if (subscription.status === "CANCELED" || subscription.status === "EXPIRED") {
    throw new PartnerBillingError("Inactive subscriptions cannot be invoiced.");
  }

  const periodStart = input.periodStart
    ? new Date(input.periodStart)
    : subscription.currentPeriodStart;
  const periodEnd = input.periodEnd
    ? new Date(input.periodEnd)
    : subscription.currentPeriodEnd;
  const dueAt = input.dueAt ? new Date(input.dueAt) : addDays(periodEnd, defaultDueDays());

  assertDate(periodStart, "Period start");
  assertDate(periodEnd, "Period end");
  assertDate(dueAt, "Due date");

  if (periodEnd <= periodStart) {
    throw new PartnerBillingError("Period end must be after period start.");
  }

  const existing = await prisma.partnerBillingInvoice.findMany({
    where: {
      subscriptionId: subscription.id,
      periodStart,
      periodEnd,
    },
    select: {
      direction: true,
    },
  });
  const existingDirections = new Set(existing.map((invoice) => invoice.direction));
  const created = [];
  const issueImmediately = input.issueImmediately ?? true;

  if (!existingDirections.has("METAWHAT_TO_PARTNER")) {
    created.push(
      await createLinkedPartnerInvoice({
        actorUserId,
        partner: subscription.partnerCompany,
        clientCompanyId: subscription.clientCompanyId,
        subscriptionId: subscription.id,
        direction: "METAWHAT_TO_PARTNER",
        billingOwnerType: subscription.billingOwnerType,
        amountPaise: subscription.wholesaleAmountPaise,
        currency: subscription.currency,
        periodStart,
        periodEnd,
        dueAt,
        issueImmediately,
      }),
    );
  }

  if (
    subscription.billingOwnerType === "PARENT_PARTNER" &&
    !existingDirections.has("PARTNER_TO_CLIENT")
  ) {
    created.push(
      await createLinkedPartnerInvoice({
        actorUserId,
        partner: subscription.partnerCompany,
        clientCompanyId: subscription.clientCompanyId,
        subscriptionId: subscription.id,
        direction: "PARTNER_TO_CLIENT",
        billingOwnerType: subscription.billingOwnerType,
        amountPaise: subscription.retailAmountPaise,
        currency: subscription.currency,
        periodStart,
        periodEnd,
        dueAt,
        issueImmediately,
      }),
    );
  }

  if (created.length === 0) {
    throw new PartnerBillingError(
      "Invoices already exist for this subscription period.",
      409,
    );
  }

  return created;
}

export async function updatePartnerBillingPayment({
  actorUserId,
  input,
  partnerBillingInvoiceId,
}: {
  actorUserId: string;
  partnerBillingInvoiceId: string;
  input: UpdatePartnerBillingPaymentInput;
}) {
  const invoice = await prisma.partnerBillingInvoice.findUnique({
    where: {
      id: partnerBillingInvoiceId,
    },
    include: {
      billingInvoice: true,
    },
  });

  if (!invoice) {
    throw new PartnerBillingError("Partner billing invoice not found.", 404);
  }

  if (invoice.paymentStatus === "PAID") {
    throw new PartnerBillingError("Paid invoices cannot be changed.");
  }

  const paidAt =
    input.paymentStatus === "PAID"
      ? input.paidAt
        ? new Date(input.paidAt)
        : new Date()
      : null;
  if (paidAt) assertDate(paidAt, "Paid at");

  const invoiceStatus: BillingInvoiceStatus =
    input.paymentStatus === "PAID"
      ? "PAID"
      : input.paymentStatus === "CANCELED"
        ? "VOID"
        : "FAILED";
  const eventType =
    input.paymentStatus === "PAID"
      ? "PAYMENT_MARKED_PAID"
      : "PAYMENT_MARKED_FAILED";

  const updated = await prisma.$transaction(async (tx) => {
    const partnerInvoice = await tx.partnerBillingInvoice.update({
      where: {
        id: invoice.id,
      },
      data: {
        paymentStatus: input.paymentStatus,
        status: invoiceStatus,
        paidAt,
        voidedAt: input.paymentStatus === "CANCELED" ? new Date() : null,
        paymentProvider: input.paymentProvider?.trim() || null,
        paymentReference: input.paymentReference?.trim() || null,
        paymentUrl: input.paymentUrl?.trim() || null,
      },
      include: {
        billingInvoice: true,
      },
    });

    await tx.billingInvoice.update({
      where: {
        id: invoice.billingInvoiceId,
      },
      data: {
        status: invoiceStatus,
        paidAt,
        voidedAt: input.paymentStatus === "CANCELED" ? new Date() : null,
        cashfreePaymentId: input.paymentReference?.trim() || null,
      },
    });

    await tx.partnerBillingInvoiceEvent.create({
      data: {
        partnerBillingInvoiceId: invoice.id,
        partnerCompanyId: invoice.partnerCompanyId,
        clientCompanyId: invoice.clientCompanyId,
        actorUserId,
        type: eventType,
        previousValues: safeJson({
          paymentStatus: invoice.paymentStatus,
          status: invoice.status,
        }),
        newValues: safeJson({
          paymentStatus: input.paymentStatus,
          status: invoiceStatus,
          paymentProvider: input.paymentProvider,
          paymentReference: input.paymentReference,
          paidAt,
        }),
        message: input.note?.trim() || "Partner billing payment updated.",
      },
    });

    return partnerInvoice;
  });

  await createPlatformAuditLog({
    actorUserId,
    action: "partner_billing.payment_updated",
    entityType: "PartnerBillingInvoice",
    entityId: invoice.id,
    metadata: safeJson({
      paymentStatus: input.paymentStatus,
      status: invoiceStatus,
      paymentReference: input.paymentReference,
    }),
  }).catch(() => undefined);

  return updated;
}

export async function markOverduePartnerBillingInvoices({
  actorUserId,
  asOf = new Date(),
}: {
  actorUserId: string;
  asOf?: Date;
}) {
  assertDate(asOf, "As of date");

  const candidates = await prisma.partnerBillingInvoice.findMany({
    where: {
      paymentStatus: "AWAITING_PAYMENT",
      dueAt: {
        lt: asOf,
      },
    },
  });

  const updated = [];

  for (const invoice of candidates) {
    const partnerInvoice = await prisma.partnerBillingInvoice.update({
      where: {
        id: invoice.id,
      },
      data: {
        paymentStatus: "OVERDUE",
        overdueAt: asOf,
      },
    });

    await recordPartnerBillingEvent({
      partnerBillingInvoiceId: invoice.id,
      partnerCompanyId: invoice.partnerCompanyId,
      clientCompanyId: invoice.clientCompanyId,
      actorUserId,
      type: "MARKED_OVERDUE",
      previousValues: {
        paymentStatus: invoice.paymentStatus,
      },
      newValues: {
        paymentStatus: "OVERDUE",
        overdueAt: asOf,
      },
      message: "Partner billing invoice marked overdue.",
    });

    updated.push(partnerInvoice);
  }

  await createPlatformAuditLog({
    actorUserId,
    action: "partner_billing.overdue_scan",
    entityType: "PartnerBillingInvoice",
    metadata: safeJson({
      asOf,
      updatedCount: updated.length,
    }),
  }).catch(() => undefined);

  return updated;
}

export async function updatePartnerSubscriptionBillingOwner({
  actorUserId,
  input,
  subscriptionId,
}: {
  actorUserId: string;
  subscriptionId: string;
  input: UpdatePartnerBillingOwnerInput;
}) {
  const subscription = await prisma.partnerClientSubscription.findUnique({
    where: {
      id: subscriptionId,
    },
    include: {
      clientCompany: true,
    },
  });

  if (!subscription) {
    throw new PartnerBillingError("Partner subscription not found.", 404);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.partnerClientSubscription.update({
      where: {
        id: subscriptionId,
      },
      data: {
        billingOwnerType: input.billingOwnerType,
      },
    });

    await tx.company.update({
      where: {
        id: subscription.clientCompanyId,
      },
      data: {
        billingOwnerType: input.billingOwnerType,
      },
    });

    await tx.partnerClientSubscriptionEvent.create({
      data: {
        subscriptionId,
        partnerCompanyId: subscription.partnerCompanyId,
        clientCompanyId: subscription.clientCompanyId,
        actorUserId,
        type: "STATUS_CHANGED",
        previousValues: safeJson({
          billingOwnerType: subscription.billingOwnerType,
        }),
        newValues: safeJson({
          billingOwnerType: input.billingOwnerType,
        }),
        message: input.note?.trim() || "Billing owner changed.",
      },
    });

    return next;
  });

  await createPlatformAuditLog({
    actorUserId,
    action: "partner_billing.owner_changed",
    entityType: "PartnerClientSubscription",
    entityId: subscriptionId,
    metadata: safeJson({
      partnerCompanyId: subscription.partnerCompanyId,
      clientCompanyId: subscription.clientCompanyId,
      previousBillingOwnerType: subscription.billingOwnerType,
      billingOwnerType: input.billingOwnerType,
    }),
  }).catch(() => undefined);

  return updated;
}
