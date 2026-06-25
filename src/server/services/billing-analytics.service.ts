import { BillingPlan, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getPlanPricePaise } from "@/server/services/plan-upgrade.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";

export class BillingAnalyticsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingAnalyticsError";
  }
}

function isEnabled() {
  return process.env.BILLING_ANALYTICS_ENABLED !== "false";
}

function currency() {
  return process.env.BILLING_ANALYTICS_CURRENCY || "INR";
}

function defaultWindowDays() {
  const value = Number(process.env.BILLING_ANALYTICS_DEFAULT_WINDOW_DAYS ?? 30);

  return Number.isFinite(value) && value > 0 ? value : 30;
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

function startOfUtcDay(date = new Date()) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function startOfNextUtcDay(date = new Date()) {
  const start = startOfUtcDay(date);

  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

function startOfUtcMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfNextUtcMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function moneyPlanValue(plan: BillingPlan) {
  if (plan === "FREE") return 0;

  return getPlanPricePaise(plan);
}

export async function calculateBillingMetrics({
  periodStart,
  periodEnd,
}: {
  periodStart: Date;
  periodEnd: Date;
}) {
  if (!isEnabled()) {
    throw new BillingAnalyticsError("Billing analytics is disabled.");
  }

  const [
    paidInvoices,
    processedRefunds,
    companies,
    failedCheckoutCount,
    failedRefundCount,
  ] = await Promise.all([
    prisma.billingInvoice.findMany({
      where: {
        status: "PAID",
        paidAt: {
          gte: periodStart,
          lt: periodEnd,
        },
      },
      select: {
        totalPaise: true,
      },
    }),

    prisma.billingRefund.findMany({
      where: {
        status: "PROCESSED",
        processedAt: {
          gte: periodStart,
          lt: periodEnd,
        },
      },
      select: {
        amountPaise: true,
      },
    }),

    prisma.company.findMany({
      select: {
        id: true,
        billingPlan: true,
        subscriptionStatus: true,
      },
    }),

    prisma.planCheckout.count({
      where: {
        status: "FAILED",
        failedAt: {
          gte: periodStart,
          lt: periodEnd,
        },
      },
    }),

    prisma.billingRefund.count({
      where: {
        status: "FAILED",
        failedAt: {
          gte: periodStart,
          lt: periodEnd,
        },
      },
    }),
  ]);

  const grossRevenuePaise = paidInvoices.reduce(
    (sum, invoice) => sum + invoice.totalPaise,
    0,
  );

  const refundPaise = processedRefunds.reduce(
    (sum, refund) => sum + refund.amountPaise,
    0,
  );

  const activeCompanies = companies.filter((company) =>
    ["TRIALING", "ACTIVE"].includes(company.subscriptionStatus),
  );

  const freeCompanies = activeCompanies.filter(
    (company) => company.billingPlan === "FREE",
  );

  const starterCompanies = activeCompanies.filter(
    (company) => company.billingPlan === "STARTER",
  );

  const growthCompanies = activeCompanies.filter(
    (company) => company.billingPlan === "GROWTH",
  );

  const businessCompanies = activeCompanies.filter(
    (company) => company.billingPlan === "BUSINESS",
  );

  const paidCompanies = activeCompanies.filter(
    (company) => company.billingPlan !== "FREE",
  );

  const pastDueCompanies = companies.filter(
    (company) => company.subscriptionStatus === "PAST_DUE",
  );

  const mrrPaise = activeCompanies.reduce(
    (sum, company) => sum + moneyPlanValue(company.billingPlan),
    0,
  );

  const planDistribution = {
    FREE: freeCompanies.length,
    STARTER: starterCompanies.length,
    GROWTH: growthCompanies.length,
    BUSINESS: businessCompanies.length,
  };

  return {
    currency: currency(),

    grossRevenuePaise,
    refundPaise,
    netRevenuePaise: grossRevenuePaise - refundPaise,

    paidInvoiceCount: paidInvoices.length,
    refundCount: processedRefunds.length,

    mrrPaise,
    arrPaise: mrrPaise * 12,

    activeCompanies: activeCompanies.length,
    paidCompanies: paidCompanies.length,
    freeCompanies: freeCompanies.length,
    pastDueCompanies: pastDueCompanies.length,

    starterCompanies: starterCompanies.length,
    growthCompanies: growthCompanies.length,
    businessCompanies: businessCompanies.length,

    failedCheckoutCount,
    failedRefundCount,

    planDistribution,
  };
}

export async function generateBillingMetricSnapshot({
  period,
  date = new Date(),
}: {
  period: "DAILY" | "MONTHLY";
  date?: Date;
}) {
  if (!isEnabled()) {
    return {
      skipped: true,
      reason: "Billing analytics disabled",
    };
  }

  const periodStart =
    period === "DAILY" ? startOfUtcDay(date) : startOfUtcMonth(date);
  const periodEnd =
    period === "DAILY" ? startOfNextUtcDay(date) : startOfNextUtcMonth(date);

  try {
    const metrics = await calculateBillingMetrics({
      periodStart,
      periodEnd,
    });

    const snapshot = await prisma.billingMetricSnapshot.upsert({
      where: {
        period_periodStart: {
          period,
          periodStart,
        },
      },
      create: {
        period,
        status: "GENERATED",
        periodStart,
        periodEnd,
        currency: metrics.currency,

        grossRevenuePaise: metrics.grossRevenuePaise,
        refundPaise: metrics.refundPaise,
        netRevenuePaise: metrics.netRevenuePaise,

        paidInvoiceCount: metrics.paidInvoiceCount,
        refundCount: metrics.refundCount,

        mrrPaise: metrics.mrrPaise,
        arrPaise: metrics.arrPaise,

        activeCompanies: metrics.activeCompanies,
        paidCompanies: metrics.paidCompanies,
        freeCompanies: metrics.freeCompanies,
        pastDueCompanies: metrics.pastDueCompanies,

        starterCompanies: metrics.starterCompanies,
        growthCompanies: metrics.growthCompanies,
        businessCompanies: metrics.businessCompanies,

        failedCheckoutCount: metrics.failedCheckoutCount,
        failedRefundCount: metrics.failedRefundCount,

        planDistribution: safeJson(metrics.planDistribution),
        metadata: safeJson({
          generatedAt: new Date(),
        }),
      },
      update: {
        status: "GENERATED",
        periodEnd,
        currency: metrics.currency,

        grossRevenuePaise: metrics.grossRevenuePaise,
        refundPaise: metrics.refundPaise,
        netRevenuePaise: metrics.netRevenuePaise,

        paidInvoiceCount: metrics.paidInvoiceCount,
        refundCount: metrics.refundCount,

        mrrPaise: metrics.mrrPaise,
        arrPaise: metrics.arrPaise,

        activeCompanies: metrics.activeCompanies,
        paidCompanies: metrics.paidCompanies,
        freeCompanies: metrics.freeCompanies,
        pastDueCompanies: metrics.pastDueCompanies,

        starterCompanies: metrics.starterCompanies,
        growthCompanies: metrics.growthCompanies,
        businessCompanies: metrics.businessCompanies,

        failedCheckoutCount: metrics.failedCheckoutCount,
        failedRefundCount: metrics.failedRefundCount,

        planDistribution: safeJson(metrics.planDistribution),
        metadata: safeJson({
          regeneratedAt: new Date(),
        }),
        failedAt: null,
        failureReason: null,
      },
    });

    return {
      snapshot,
    };
  } catch (error) {
    await prisma.billingMetricSnapshot.upsert({
      where: {
        period_periodStart: {
          period,
          periodStart,
        },
      },
      create: {
        period,
        status: "FAILED",
        periodStart,
        periodEnd,
        currency: currency(),
        failedAt: new Date(),
        failureReason:
          error instanceof Error
            ? error.message
            : "Unknown billing analytics error",
      },
      update: {
        status: "FAILED",
        failedAt: new Date(),
        failureReason:
          error instanceof Error
            ? error.message
            : "Unknown billing analytics error",
      },
    });

    throw error;
  }
}

export async function generateCurrentBillingSnapshots() {
  const [daily, monthly] = await Promise.all([
    generateBillingMetricSnapshot({
      period: "DAILY",
    }),
    generateBillingMetricSnapshot({
      period: "MONTHLY",
    }),
  ]);

  return {
    daily,
    monthly,
  };
}

export async function getBillingAnalyticsDashboard() {
  const now = new Date();
  const windowStart = addDays(now, -defaultWindowDays());

  const [currentMetrics, dailySnapshots, monthlySnapshots] = await Promise.all([
    calculateBillingMetrics({
      periodStart: windowStart,
      periodEnd: now,
    }),

    prisma.billingMetricSnapshot.findMany({
      where: {
        period: "DAILY",
      },
      orderBy: {
        periodStart: "desc",
      },
      take: 30,
    }),

    prisma.billingMetricSnapshot.findMany({
      where: {
        period: "MONTHLY",
      },
      orderBy: {
        periodStart: "desc",
      },
      take: 12,
    }),
  ]);

  return {
    windowDays: defaultWindowDays(),
    currentMetrics,
    dailySnapshots,
    monthlySnapshots,
  };
}

export async function getBillingAnalyticsHealth() {
  const [generated24h, failed24h, latestDaily, latestMonthly] =
    await Promise.all([
      prisma.billingMetricSnapshot.count({
        where: {
          status: "GENERATED",
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),

      prisma.billingMetricSnapshot.count({
        where: {
          status: "FAILED",
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),

      prisma.billingMetricSnapshot.findFirst({
        where: {
          period: "DAILY",
          status: "GENERATED",
        },
        orderBy: {
          periodStart: "desc",
        },
      }),

      prisma.billingMetricSnapshot.findFirst({
        where: {
          period: "MONTHLY",
          status: "GENERATED",
        },
        orderBy: {
          periodStart: "desc",
        },
      }),
    ]);

  return {
    enabled: isEnabled(),
    generated24h,
    failed24h,
    latestDailyAt: latestDaily?.periodStart ?? null,
    latestMonthlyAt: latestMonthly?.periodStart ?? null,
    isHealthy: isEnabled() && failed24h === 0,
  };
}
