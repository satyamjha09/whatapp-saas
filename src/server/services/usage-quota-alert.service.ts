import {
  FeatureEntitlementKey,
  Prisma,
  UsageQuotaAlertSeverity,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getCompanyEntitlement,
  getCompanyMonthlyMessageLimit,
} from "@/server/services/feature-entitlement.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";

function isEnabled() {
  return process.env.USAGE_QUOTA_ALERTS_ENABLED !== "false";
}

function shouldNotify() {
  return process.env.USAGE_QUOTA_ALERTS_AUTO_NOTIFY !== "false";
}

function thresholds() {
  return (process.env.USAGE_QUOTA_ALERT_THRESHOLDS || "80,90,100")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0)
    .sort((left, right) => left - right);
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

function severityForThreshold(threshold: number): UsageQuotaAlertSeverity {
  if (threshold >= 100) return "CRITICAL";
  if (threshold >= 90) return "WARNING";
  return "INFO";
}

function buildMessage({
  featureKey,
  usedCount,
  limitValue,
  percentage,
}: {
  featureKey: string;
  usedCount: number;
  limitValue: number;
  percentage: number;
}) {
  if (percentage >= 100) {
    return `${featureKey} quota is fully used: ${usedCount}/${limitValue}. Upgrade your plan or request an override.`;
  }

  return `${featureKey} quota is ${Math.floor(
    percentage,
  )}% used: ${usedCount}/${limitValue}. Consider upgrading before usage is blocked.`;
}

async function getLimitValue({
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
    return getCompanyMonthlyMessageLimit({ companyId });
  }

  return entitlement.limitValue;
}

async function createNotification({
  companyId,
  counterId,
  title,
  message,
  featureKey,
  thresholdPercent,
}: {
  companyId: string;
  counterId: string;
  title: string;
  message: string;
  featureKey: string;
  thresholdPercent: number;
}) {
  if (!shouldNotify()) return null;

  const idempotencyKey = `usage-quota:${counterId}:${thresholdPercent}`;

  return prisma.companyNotification.upsert({
    where: {
      companyId_idempotencyKey: {
        companyId,
        idempotencyKey,
      },
    },
    create: {
      companyId,
      type: "BILLING",
      severity: thresholdPercent >= 100 ? "ERROR" : "WARNING",
      status: "UNREAD",
      title,
      message,
      actionHref: "/dashboard/billing/usage-quotas",
      idempotencyKey,
      metadata: safeJson({
        featureKey,
        thresholdPercent,
        counterId,
      }),
    },
    update: {
      title,
      message,
      metadata: safeJson({
        featureKey,
        thresholdPercent,
        counterId,
      }),
    },
  });
}

export async function scanUsageQuotaAlerts() {
  if (!isEnabled()) {
    return {
      skipped: true,
      reason: "Usage quota alerts disabled",
    };
  }

  const counters = await prisma.featureUsageCounter.findMany({
    where: {
      usedCount: {
        gt: 0,
      },
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          billingPlan: true,
        },
      },
    },
  });

  const alertThresholds = thresholds();

  let checked = 0;
  let created = 0;

  for (const counter of counters) {
    checked += 1;

    const limitValue = await getLimitValue({
      companyId: counter.companyId,
      featureKey: counter.featureKey,
    });

    if (!limitValue || limitValue <= 0) continue;

    const percentage = (counter.usedCount / limitValue) * 100;

    for (const threshold of alertThresholds) {
      const existingAlert = await prisma.usageQuotaAlert.findUnique({
        where: {
          companyId_counterId_thresholdPercent: {
            companyId: counter.companyId,
            counterId: counter.id,
            thresholdPercent: threshold,
          },
        },
      });

      if (percentage < threshold) {
        if (existingAlert && existingAlert.status !== "RESOLVED") {
          await prisma.usageQuotaAlert.update({
            where: {
              id: existingAlert.id,
            },
            data: {
              status: "RESOLVED",
              resolvedAt: new Date(),
            },
          });
        }

        continue;
      }

      const message = buildMessage({
        featureKey: counter.featureKey,
        usedCount: counter.usedCount,
        limitValue,
        percentage,
      });

      await prisma.usageQuotaAlert.upsert({
        where: {
          companyId_counterId_thresholdPercent: {
            companyId: counter.companyId,
            counterId: counter.id,
            thresholdPercent: threshold,
          },
        },
        create: {
          companyId: counter.companyId,
          counterId: counter.id,
          featureKey: counter.featureKey,
          thresholdPercent: threshold,
          usedCount: counter.usedCount,
          limitValue,
          percentage,
          severity: severityForThreshold(threshold),
          status: "ACTIVE",
          message,
          metadata: safeJson({
            billingPlan: counter.company.billingPlan,
            periodType: counter.periodType,
            periodStart: counter.periodStart,
            periodEnd: counter.periodEnd,
          }),
        },
        update: {
          usedCount: counter.usedCount,
          limitValue,
          percentage,
          severity: severityForThreshold(threshold),
          status: "ACTIVE",
          message,
          resolvedAt: null,
        },
      });

      if (!existingAlert) {
        created += 1;

        await createNotification({
          companyId: counter.companyId,
          counterId: counter.id,
          title: `${counter.featureKey} quota alert`,
          message,
          featureKey: counter.featureKey,
          thresholdPercent: threshold,
        });
      }
    }
  }

  return {
    checked,
    created,
  };
}

export async function listCompanyUsageQuotaAlerts({
  companyId,
}: {
  companyId: string;
}) {
  return prisma.usageQuotaAlert.findMany({
    where: {
      companyId,
      status: {
        in: ["ACTIVE", "ACKNOWLEDGED"],
      },
    },
    orderBy: [
      {
        severity: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
    take: 100,
  });
}

export async function acknowledgeUsageQuotaAlert({
  companyId,
  alertId,
}: {
  companyId: string;
  alertId: string;
}) {
  return prisma.usageQuotaAlert.update({
    where: {
      id: alertId,
      companyId,
    },
    data: {
      status: "ACKNOWLEDGED",
      acknowledgedAt: new Date(),
    },
  });
}

export async function resolveUsageQuotaAlert({
  companyId,
  alertId,
}: {
  companyId: string;
  alertId: string;
}) {
  return prisma.usageQuotaAlert.update({
    where: {
      id: alertId,
      companyId,
    },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
    },
  });
}

export async function getUsageQuotaAlertHealth() {
  const [activeAlerts, criticalAlerts, alerts24h] = await Promise.all([
    prisma.usageQuotaAlert.count({
      where: {
        status: "ACTIVE",
      },
    }),
    prisma.usageQuotaAlert.count({
      where: {
        status: "ACTIVE",
        severity: "CRITICAL",
      },
    }),
    prisma.usageQuotaAlert.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  return {
    enabled: isEnabled(),
    activeAlerts,
    criticalAlerts,
    alerts24h,
    isHealthy: isEnabled(),
  };
}
