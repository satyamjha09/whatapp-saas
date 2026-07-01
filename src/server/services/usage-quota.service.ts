import {
  FeatureEntitlementKey,
  FeatureUsagePeriodType,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getCompanyEntitlement,
  getCompanyMonthlyMessageLimit,
} from "@/server/services/feature-entitlement.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";

export class UsageQuotaExceededError extends Error {
  code = "USAGE_QUOTA_EXCEEDED";

  constructor(message: string) {
    super(message);
    this.name = "UsageQuotaExceededError";
  }
}

const TRACKED_QUOTA_FEATURES: FeatureEntitlementKey[] = [
  "CONTACTS",
  "TEMPLATES",
  "CAMPAIGNS",
  "BULK_MESSAGING",
  "COMPLIANCE_EXPORTS",
  "TEAM",
];

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

function isEnabled() {
  return process.env.USAGE_QUOTAS_ENABLED !== "false";
}

function isStrictMode() {
  return process.env.USAGE_QUOTAS_STRICT_MODE !== "false";
}

function logAllowedChecks() {
  return process.env.USAGE_QUOTAS_LOG_ALLOWED === "true";
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

function startOfMonth(date = new Date()) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0),
  );
}

function startOfNextMonth(date = new Date()) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0),
  );
}

function lifetimeStart() {
  return new Date(Date.UTC(2026, 0, 1, 0, 0, 0));
}

function configuredPeriod(
  key: string,
  fallback: FeatureUsagePeriodType,
): FeatureUsagePeriodType {
  const value = process.env[key];

  return value === "MONTHLY" || value === "LIFETIME" ? value : fallback;
}

function getPeriodTypeForFeature(
  featureKey: FeatureEntitlementKey,
): FeatureUsagePeriodType {
  if (featureKey === "CONTACTS") {
    return configuredPeriod("USAGE_QUOTAS_CONTACT_PERIOD", "LIFETIME");
  }

  if (featureKey === "TEMPLATES") {
    return configuredPeriod("USAGE_QUOTAS_TEMPLATE_PERIOD", "LIFETIME");
  }

  if (featureKey === "CAMPAIGNS") {
    return configuredPeriod("USAGE_QUOTAS_CAMPAIGN_PERIOD", "MONTHLY");
  }

  if (featureKey === "COMPLIANCE_EXPORTS") {
    return configuredPeriod(
      "USAGE_QUOTAS_COMPLIANCE_EXPORT_PERIOD",
      "MONTHLY",
    );
  }

  if (featureKey === "TEAM") {
    return "LIFETIME";
  }

  return configuredPeriod("USAGE_QUOTAS_MESSAGE_PERIOD", "MONTHLY");
}

function getPeriodWindow(periodType: FeatureUsagePeriodType, date = new Date()) {
  if (periodType === "LIFETIME") {
    return {
      periodStart: lifetimeStart(),
      periodEnd: null,
    };
  }

  return {
    periodStart: startOfMonth(date),
    periodEnd: startOfNextMonth(date),
  };
}

async function getQuotaLimitValue({
  companyId,
  featureKey,
}: {
  companyId: string;
  featureKey: FeatureEntitlementKey;
}) {
  const entitlement = await getCompanyEntitlement({
    companyId,
    featureKey,
  });

  if (featureKey === "BULK_MESSAGING" && entitlement.limitValue === null) {
    return {
      ...entitlement,
      limitValue: await getCompanyMonthlyMessageLimit({ companyId }),
    };
  }

  return entitlement;
}

async function upsertUsageCounter(
  client: PrismaClientOrTransaction,
  {
    companyId,
    featureKey,
    periodDate,
  }: {
    companyId: string;
    featureKey: FeatureEntitlementKey;
    periodDate?: Date;
  },
) {
  const periodType = getPeriodTypeForFeature(featureKey);
  const { periodStart, periodEnd } = getPeriodWindow(periodType, periodDate);

  return client.featureUsageCounter.upsert({
    where: {
      companyId_featureKey_periodType_periodStart: {
        companyId,
        featureKey,
        periodType,
        periodStart,
      },
    },
    create: {
      companyId,
      featureKey,
      periodType,
      periodStart,
      periodEnd,
      usedCount: 0,
    },
    update: {
      periodEnd,
    },
  });
}

export async function getOrCreateUsageCounter({
  companyId,
  featureKey,
}: {
  companyId: string;
  featureKey: FeatureEntitlementKey;
}) {
  return upsertUsageCounter(prisma, { companyId, featureKey });
}

export async function getUsageQuotaState({
  companyId,
  featureKey,
}: {
  companyId: string;
  featureKey: FeatureEntitlementKey;
}) {
  const [entitlement, counter] = await Promise.all([
    getQuotaLimitValue({
      companyId,
      featureKey,
    }),
    getOrCreateUsageCounter({
      companyId,
      featureKey,
    }),
  ]);

  return {
    companyId,
    featureKey,
    enabled: entitlement.enabled,
    limitValue: entitlement.limitValue,
    usedCount: counter.usedCount,
    remaining:
      entitlement.limitValue === null
        ? null
        : Math.max(entitlement.limitValue - counter.usedCount, 0),
    periodType: counter.periodType,
    periodStart: counter.periodStart,
    periodEnd: counter.periodEnd,
    counterId: counter.id,
  };
}

export async function assertUsageQuotaAvailable({
  companyId,
  featureKey,
  amount = 1,
}: {
  companyId: string;
  featureKey: FeatureEntitlementKey;
  amount?: number;
}) {
  if (!isEnabled() || amount < 1) return;

  const state = await getUsageQuotaState({
    companyId,
    featureKey,
  });

  if (!state.enabled && isStrictMode()) {
    throw new UsageQuotaExceededError(`${featureKey} is not enabled for this plan.`);
  }

  if (state.limitValue === null) {
    return;
  }

  if (state.usedCount + amount > state.limitValue) {
    throw new UsageQuotaExceededError(
      `${featureKey} quota exceeded. Used ${state.usedCount}/${state.limitValue}.`,
    );
  }
}

export async function incrementUsageQuota({
  companyId,
  featureKey,
  amount = 1,
  idempotencyKey,
  reason,
  metadata,
}: {
  companyId: string;
  featureKey: FeatureEntitlementKey;
  amount?: number;
  idempotencyKey?: string | null;
  reason?: string | null;
  metadata?: unknown;
}) {
  if (!isEnabled()) {
    return null;
  }

  if (amount <= 0) {
    throw new Error("amount must be greater than 0");
  }

  if (idempotencyKey) {
    const existing = await prisma.featureUsageEvent.findUnique({
      where: {
        companyId_featureKey_idempotencyKey: {
          companyId,
          featureKey,
          idempotencyKey,
        },
      },
    });

    if (existing) {
      return existing;
    }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const counter = await upsertUsageCounter(tx, {
        companyId,
        featureKey,
      });

      const entitlement = await getQuotaLimitValue({
        companyId,
        featureKey,
      });

      if (!entitlement.enabled && isStrictMode()) {
        throw new UsageQuotaExceededError(
          `${featureKey} is not enabled for this plan.`,
        );
      }

      const updateWhere =
        entitlement.limitValue === null
          ? { id: counter.id }
          : {
              id: counter.id,
              usedCount: {
                lte: entitlement.limitValue - amount,
              },
            };

      const updateResult = await tx.featureUsageCounter.updateMany({
        where: updateWhere,
        data: {
          usedCount: {
            increment: amount,
          },
        },
      });

      if (updateResult.count !== 1) {
        throw new UsageQuotaExceededError(
          `${featureKey} quota exceeded. Used ${counter.usedCount}/${entitlement.limitValue}.`,
        );
      }

      const updated = await tx.featureUsageCounter.findUniqueOrThrow({
        where: {
          id: counter.id,
        },
      });

      const beforeCount = updated.usedCount - amount;

      return tx.featureUsageEvent.create({
        data: {
          companyId,
          counterId: updated.id,
          featureKey,
          type: "INCREMENT",
          status: "APPLIED",
          amount,
          beforeCount,
          afterCount: updated.usedCount,
          idempotencyKey: idempotencyKey ?? null,
          reason: reason ?? null,
          metadata: metadata ? safeJson(metadata) : undefined,
        },
      });
    });
  } catch (error) {
    if (
      idempotencyKey &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.featureUsageEvent.findUnique({
        where: {
          companyId_featureKey_idempotencyKey: {
            companyId,
            featureKey,
            idempotencyKey,
          },
        },
      });

      if (existing) {
        return existing;
      }
    }

    throw error;
  }
}

export async function decrementUsageQuota({
  companyId,
  featureKey,
  amount = 1,
  idempotencyKey,
  periodDate,
  reason,
  metadata,
}: {
  companyId: string;
  featureKey: FeatureEntitlementKey;
  amount?: number;
  idempotencyKey?: string | null;
  periodDate?: Date;
  reason?: string | null;
  metadata?: unknown;
}) {
  if (!isEnabled()) {
    return null;
  }

  if (amount <= 0) {
    throw new Error("amount must be greater than 0");
  }

  if (idempotencyKey) {
    const existing = await prisma.featureUsageEvent.findUnique({
      where: {
        companyId_featureKey_idempotencyKey: {
          companyId,
          featureKey,
          idempotencyKey,
        },
      },
    });

    if (existing) {
      return existing;
    }
  }

  return prisma.$transaction(async (tx) => {
    const counter = await upsertUsageCounter(tx, {
      companyId,
      featureKey,
      periodDate,
    });

    const beforeCount = counter.usedCount;
    const afterCount = Math.max(counter.usedCount - amount, 0);

    const updated = await tx.featureUsageCounter.update({
      where: {
        id: counter.id,
      },
      data: {
        usedCount: afterCount,
      },
    });

    return tx.featureUsageEvent.create({
      data: {
        companyId,
        counterId: updated.id,
        featureKey,
        type: "DECREMENT",
        status: "APPLIED",
        amount,
        beforeCount,
        afterCount,
        idempotencyKey: idempotencyKey ?? null,
        reason: reason ?? null,
        metadata: metadata ? safeJson(metadata) : undefined,
      },
    });
  });
}

export async function syncUsageCountersForCompany({
  companyId,
}: {
  companyId: string;
}) {
  const [contacts, templates, campaigns, complianceExports, teamUsers] =
    await Promise.all([
      prisma.contact.count({
        where: {
          companyId,
        },
      }),
      prisma.template.count({
        where: {
          companyId,
        },
      }),
      prisma.campaign.count({
        where: {
          companyId,
          createdAt: {
            gte: startOfMonth(),
            lt: startOfNextMonth(),
          },
        },
      }),
      prisma.complianceEvidenceExport.count({
        where: {
          companyId,
          createdAt: {
            gte: startOfMonth(),
            lt: startOfNextMonth(),
          },
        },
      }),
      prisma.companyUser.count({
        where: {
          companyId,
        },
      }),
    ]);

  const values: Array<{
    featureKey: FeatureEntitlementKey;
    usedCount: number;
  }> = [
    {
      featureKey: "CONTACTS",
      usedCount: contacts,
    },
    {
      featureKey: "TEMPLATES",
      usedCount: templates,
    },
    {
      featureKey: "CAMPAIGNS",
      usedCount: campaigns,
    },
    {
      featureKey: "COMPLIANCE_EXPORTS",
      usedCount: complianceExports,
    },
    {
      featureKey: "TEAM",
      usedCount: teamUsers,
    },
  ];

  const results = [];

  for (const item of values) {
    const counter = await getOrCreateUsageCounter({
      companyId,
      featureKey: item.featureKey,
    });

    const beforeCount = counter.usedCount;

    const updated = await prisma.featureUsageCounter.update({
      where: {
        id: counter.id,
      },
      data: {
        usedCount: item.usedCount,
      },
    });

    await prisma.featureUsageEvent.create({
      data: {
        companyId,
        counterId: updated.id,
        featureKey: item.featureKey,
        type: "SET",
        status: "APPLIED",
        amount: item.usedCount,
        beforeCount,
        afterCount: item.usedCount,
        reason: "usage-counter-sync",
      },
    });

    results.push({
      featureKey: item.featureKey,
      beforeCount,
      afterCount: item.usedCount,
    });
  }

  return results;
}

export async function listCompanyUsageQuotas({
  companyId,
}: {
  companyId: string;
}) {
  if (!isEnabled()) {
    return [];
  }

  await Promise.all(
    TRACKED_QUOTA_FEATURES.map((featureKey) =>
      getOrCreateUsageCounter({ companyId, featureKey }),
    ),
  );

  const counters = await prisma.featureUsageCounter.findMany({
    where: {
      companyId,
      featureKey: {
        in: TRACKED_QUOTA_FEATURES,
      },
    },
    orderBy: [
      {
        featureKey: "asc",
      },
      {
        periodStart: "desc",
      },
    ],
  });

  const states = [];

  for (const counter of counters) {
    const entitlement = await getQuotaLimitValue({
      companyId,
      featureKey: counter.featureKey,
    });

    states.push({
      ...counter,
      enabled: entitlement.enabled,
      limitValue: entitlement.limitValue,
      remaining:
        entitlement.limitValue === null
          ? null
          : Math.max(entitlement.limitValue - counter.usedCount, 0),
    });
  }

  return states;
}

export async function getUsageQuotaHealth() {
  const [counters, events24h, companiesWithoutCounters, blocked24h] =
    await Promise.all([
      prisma.featureUsageCounter.count(),
      prisma.featureUsageEvent.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.company.count({
        where: {
          featureUsageCounters: {
            none: {},
          },
        },
      }),
      prisma.featureUsageEvent.count({
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
    strictMode: isStrictMode(),
    logAllowedChecks: logAllowedChecks(),
    counters,
    events24h,
    blocked24h,
    companiesWithoutCounters,
    isHealthy: isEnabled(),
  };
}
