import { BillingPlan, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";
import { getInvoiceBillingSnapshot } from "@/server/services/company-billing-profile.service";

function isEnabled() {
  return process.env.BILLING_INVOICES_ENABLED !== "false";
}

function invoicePrefix() {
  return process.env.BILLING_INVOICE_PREFIX || "TK";
}

function taxBasisPoints() {
  const value = Number(process.env.BILLING_INVOICE_TAX_BASIS_POINTS ?? 0);

  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

function calculateTax(subtotalPaise: number, basisPoints: number) {
  return Math.round((subtotalPaise * basisPoints) / 10_000);
}

async function nextInvoiceNumber() {
  const year = new Date().getFullYear();

  const count = await prisma.billingInvoice.count({
    where: {
      createdAt: {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      },
    },
  });

  return `${invoicePrefix()}-${year}-${String(count + 1).padStart(6, "0")}`;
}

export async function createPaidPlanUpgradeInvoice({
  companyId,
  userId,
  planCheckoutId,
  planChangeId,
  toPlan,
  amountPaise,
  currency = "INR",
  razorpayOrderId,
  razorpayPaymentId,
}: {
  companyId: string;
  userId?: string | null;
  planCheckoutId?: string | null;
  planChangeId?: string | null;
  toPlan: BillingPlan;
  amountPaise: number;
  currency?: string;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
}) {
  if (!isEnabled()) return null;

  const company = await prisma.company.findUnique({
    where: {
      id: companyId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!company) {
    throw new Error("Company not found");
  }

  const billingSnapshot = await getInvoiceBillingSnapshot({
    companyId,
  });

  const basisPoints = taxBasisPoints();
  const subtotalPaise = amountPaise;
  const taxPaise = calculateTax(subtotalPaise, basisPoints);
  const totalPaise = subtotalPaise + taxPaise;
  const now = new Date();

  const invoice = await prisma.billingInvoice.create({
    data: {
      companyId,
      userId: userId ?? null,
      invoiceNumber: await nextInvoiceNumber(),
      status: "PAID",
      currency,
      subtotalPaise,
      taxPaise,
      totalPaise,
      taxBasisPoints: basisPoints,

      billingName: billingSnapshot.billingName,
      billingEmail: billingSnapshot.billingEmail,
      billingAddress: billingSnapshot.billingAddress || null,
      billingTaxId: billingSnapshot.billingTaxId,

      sellerName: process.env.BILLING_SELLER_NAME || "TallyKonnect",
      sellerEmail: process.env.BILLING_SELLER_EMAIL || null,
      sellerAddress: process.env.BILLING_SELLER_ADDRESS || null,
      sellerTaxId: process.env.BILLING_SELLER_TAX_ID || null,

      razorpayOrderId: razorpayOrderId ?? null,
      razorpayPaymentId: razorpayPaymentId ?? null,

      planCheckoutId: planCheckoutId ?? null,
      planChangeId: planChangeId ?? null,

      issuedAt: now,
      paidAt: now,

      metadata: safeJson({
        source: "plan-upgrade-checkout",
        toPlan,
        billingTaxIdLabel: billingSnapshot.billingTaxIdLabel,
        invoiceNotes: billingSnapshot.invoiceNotes,
      }),

      lines: {
        create: [
          {
            type: "PLAN",
            description: `${toPlan} plan upgrade`,
            quantity: 1,
            unitAmountPaise: subtotalPaise,
            totalPaise: subtotalPaise,
            metadata: safeJson({
              toPlan,
            }),
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
    include: {
      lines: true,
    },
  });

  await createAuditLog({
    companyId,
    actorUserId: userId ?? undefined,
    action: "billing.invoice_created",
    entityType: "BillingInvoice",
    entityId: invoice.id,
    metadata: {
      invoiceNumber: invoice.invoiceNumber,
      totalPaise: invoice.totalPaise,
      currency: invoice.currency,
      planCheckoutId,
      planChangeId,
      razorpayOrderId,
      razorpayPaymentId,
    },
  }).catch(() => undefined);

  return invoice;
}

export async function listCompanyBillingInvoices({
  companyId,
}: {
  companyId: string;
}) {
  return prisma.billingInvoice.findMany({
    where: {
      companyId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
    include: {
      lines: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

export async function getCompanyBillingInvoice({
  companyId,
  invoiceId,
}: {
  companyId: string;
  invoiceId: string;
}) {
  return prisma.billingInvoice.findFirst({
    where: {
      id: invoiceId,
      companyId,
    },
    include: {
      lines: true,
      company: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

export async function getBillingInvoiceHealth() {
  const [paid24h, failed24h, totalPaid] = await Promise.all([
    prisma.billingInvoice.count({
      where: {
        status: "PAID",
        paidAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.billingInvoice.count({
      where: {
        status: "FAILED",
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.billingInvoice.count({
      where: {
        status: "PAID",
      },
    }),
  ]);

  return {
    enabled: isEnabled(),
    paid24h,
    failed24h,
    totalPaid,
    isHealthy: isEnabled() && failed24h === 0,
  };
}
