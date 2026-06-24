import {
  BillingPlan,
  Prisma,
  SubscriptionRenewalEventStatus,
  SubscriptionRenewalEventType,
  SubscriptionStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit.service";
import { createCompanyNotification } from "@/server/services/company-notification.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";

type RenewalCompany = {
  id: string;
  name: string;
  billingPlan: BillingPlan;
  subscriptionStatus: SubscriptionStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
};

type RenewalCompanyWithLimit = RenewalCompany & {
  monthlyMessageLimit: number;
};

function isEnabled() {
  return process.env.SUBSCRIPTION_RENEWALS_ENABLED !== "false";
}

function graceDays() {
  const parsed = Number(process.env.SUBSCRIPTION_RENEWAL_GRACE_DAYS ?? 7);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 7;
}

function autoDowngradeAfterGrace() {
  return process.env.SUBSCRIPTION_AUTO_DOWNGRADE_AFTER_GRACE !== "false";
}

function downgradePlan(): BillingPlan {
  const configuredPlan = process.env.SUBSCRIPTION_DOWNGRADE_PLAN as
    | BillingPlan
    | undefined;

  return configuredPlan || "FREE";
}

function freeMonthlyMessageLimit() {
  const parsed = Number(process.env.SUBSCRIPTION_FREE_MONTHLY_MESSAGE_LIMIT ?? 100);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 100;
}

function reminderDays() {
  return (process.env.SUBSCRIPTION_RENEWAL_REMINDER_DAYS || "7,3,1")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(redactSensitiveData(value))) as Prisma.InputJsonValue;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function startOfToday() {
  const now = new Date();

  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function endOfToday() {
  return addDays(startOfToday(), 1);
}

async function createRenewalEvent({
  companyId,
  type,
  status = "SUCCESS",
  billingPlan,
  subscriptionStatus,
  periodStart,
  periodEnd,
  reminderDaysBeforeEnd,
  previousPlan,
  newPlan,
  previousMonthlyMessageLimit,
  newMonthlyMessageLimit,
  idempotencyKey,
  message,
  errorMessage,
  metadata,
}: {
  companyId: string;
  type: SubscriptionRenewalEventType;
  status?: SubscriptionRenewalEventStatus;
  billingPlan: BillingPlan;
  subscriptionStatus: SubscriptionStatus;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  reminderDaysBeforeEnd?: number | null;
  previousPlan?: BillingPlan | null;
  newPlan?: BillingPlan | null;
  previousMonthlyMessageLimit?: number | null;
  newMonthlyMessageLimit?: number | null;
  idempotencyKey?: string | null;
  message?: string | null;
  errorMessage?: string | null;
  metadata?: unknown;
}) {
  const data = {
    companyId,
    type,
    status,
    billingPlan,
    subscriptionStatus,
    periodStart: periodStart ?? null,
    periodEnd: periodEnd ?? null,
    reminderDaysBeforeEnd: reminderDaysBeforeEnd ?? null,
    previousPlan: previousPlan ?? null,
    newPlan: newPlan ?? null,
    previousMonthlyMessageLimit: previousMonthlyMessageLimit ?? null,
    newMonthlyMessageLimit: newMonthlyMessageLimit ?? null,
    message: message ?? null,
    errorMessage: errorMessage ?? null,
    metadata: metadata ? safeJson(metadata) : undefined,
  };

  if (idempotencyKey) {
    return prisma.subscriptionRenewalEvent.upsert({
      where: {
        companyId_idempotencyKey: {
          companyId,
          idempotencyKey,
        },
      },
      create: {
        ...data,
        idempotencyKey,
      },
      update: {},
    });
  }

  return prisma.subscriptionRenewalEvent.create({
    data,
  });
}

async function sendRenewalReminder({
  company,
  daysBeforeEnd,
}: {
  company: RenewalCompany;
  daysBeforeEnd: number;
}) {
  const idempotencyKey = `subscription-renewal-reminder:${company.id}:${company.currentPeriodEnd?.toISOString()}:${daysBeforeEnd}`;

  const event = await createRenewalEvent({
    companyId: company.id,
    type: "REMINDER_SENT",
    billingPlan: company.billingPlan,
    subscriptionStatus: company.subscriptionStatus,
    periodStart: company.currentPeriodStart,
    periodEnd: company.currentPeriodEnd,
    reminderDaysBeforeEnd: daysBeforeEnd,
    idempotencyKey,
    message: `Subscription renewal reminder sent ${daysBeforeEnd} day(s) before period end.`,
  });

  await createCompanyNotification({
    companyId: company.id,
    type: "BILLING",
    severity: daysBeforeEnd <= 1 ? "WARNING" : "INFO",
    title: "Subscription renewal reminder",
    message: `Your ${company.billingPlan} plan renews in ${daysBeforeEnd} day(s). Keep billing active to avoid service interruption.`,
    actionHref: "/dashboard/billing/upgrade",
    idempotencyKey,
    metadata: safeJson({
      renewalEventId: event.id,
      daysBeforeEnd,
      periodEnd: company.currentPeriodEnd,
    }),
  }).catch(() => undefined);

  return event;
}

async function markPastDue({ company }: { company: RenewalCompany }) {
  if (company.subscriptionStatus === "PAST_DUE") {
    return null;
  }

  const idempotencyKey = `subscription-marked-past-due:${company.id}:${company.currentPeriodEnd?.toISOString()}`;

  await prisma.company.update({
    where: {
      id: company.id,
    },
    data: {
      subscriptionStatus: "PAST_DUE",
    },
  });

  const event = await createRenewalEvent({
    companyId: company.id,
    type: "MARKED_PAST_DUE",
    billingPlan: company.billingPlan,
    subscriptionStatus: "PAST_DUE",
    periodStart: company.currentPeriodStart,
    periodEnd: company.currentPeriodEnd,
    idempotencyKey,
    message: "Subscription period ended and company was marked past due.",
  });

  await createCompanyNotification({
    companyId: company.id,
    type: "BILLING",
    severity: "ERROR",
    title: "Subscription payment overdue",
    message: `Your ${company.billingPlan} plan is past due. Please renew within ${graceDays()} day(s) to avoid downgrade.`,
    actionHref: "/dashboard/billing/upgrade",
    idempotencyKey,
    metadata: safeJson({
      renewalEventId: event.id,
      graceDays: graceDays(),
    }),
  }).catch(() => undefined);

  return event;
}

async function autoDowngradeCompany({
  company,
}: {
  company: RenewalCompanyWithLimit;
}) {
  if (!autoDowngradeAfterGrace()) return null;
  if (company.billingPlan === downgradePlan()) return null;
  if (!company.currentPeriodEnd) return null;

  const graceEnd = addDays(company.currentPeriodEnd, graceDays());

  if (graceEnd > new Date()) return null;

  const previousPlan = company.billingPlan;
  const previousMonthlyMessageLimit = company.monthlyMessageLimit;
  const newPlan = downgradePlan();
  const newMonthlyMessageLimit = freeMonthlyMessageLimit();
  const now = new Date();
  const idempotencyKey = `subscription-auto-downgraded:${company.id}:${company.currentPeriodEnd.toISOString()}`;

  const result = await prisma.$transaction(async (tx) => {
    await tx.company.update({
      where: {
        id: company.id,
      },
      data: {
        billingPlan: newPlan,
        subscriptionStatus: "ACTIVE",
        monthlyMessageLimit: newMonthlyMessageLimit,
        currentPeriodStart: now,
        currentPeriodEnd: addDays(now, 30),
        cancelAtPeriodEnd: false,
        subscriptionCanceledAt: null,
      },
    });

    const planChange = await tx.companyPlanChange.create({
      data: {
        companyId: company.id,
        fromPlan: previousPlan,
        toPlan: newPlan,
        source: "SYSTEM",
        previousMonthlyMessageLimit,
        newMonthlyMessageLimit,
        reason: "auto-downgrade-after-renewal-grace",
        metadata: safeJson({
          previousPeriodEnd: company.currentPeriodEnd,
          graceDays: graceDays(),
        }),
      },
    });

    return {
      planChange,
    };
  });

  const event = await createRenewalEvent({
    companyId: company.id,
    type: "AUTO_DOWNGRADED",
    billingPlan: previousPlan,
    subscriptionStatus: "PAST_DUE",
    periodStart: company.currentPeriodStart,
    periodEnd: company.currentPeriodEnd,
    previousPlan,
    newPlan,
    previousMonthlyMessageLimit,
    newMonthlyMessageLimit,
    idempotencyKey,
    message: `Company auto-downgraded from ${previousPlan} to ${newPlan}.`,
    metadata: {
      planChangeId: result.planChange.id,
    },
  });

  await createCompanyNotification({
    companyId: company.id,
    type: "BILLING",
    severity: "ERROR",
    title: "Plan downgraded",
    message: `Your subscription grace period ended, so your company was downgraded to ${newPlan}. Upgrade again to restore paid features.`,
    actionHref: "/dashboard/billing/upgrade",
    idempotencyKey,
    metadata: safeJson({
      renewalEventId: event.id,
      planChangeId: result.planChange.id,
    }),
  }).catch(() => undefined);

  await createAuditLog({
    companyId: company.id,
    action: "billing.subscription_auto_downgraded",
    entityType: "Company",
    entityId: company.id,
    metadata: safeJson({
      previousPlan,
      newPlan,
      previousMonthlyMessageLimit,
      newMonthlyMessageLimit,
      planChangeId: result.planChange.id,
    }),
  }).catch(() => undefined);

  return event;
}

export async function scanSubscriptionRenewals() {
  if (!isEnabled()) {
    return {
      skipped: true,
      reason: "Subscription renewals disabled",
    };
  }

  const companies = await prisma.company.findMany({
    where: {
      billingPlan: {
        not: "FREE",
      },
      currentPeriodEnd: {
        not: null,
      },
    },
    select: {
      id: true,
      name: true,
      billingPlan: true,
      subscriptionStatus: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      monthlyMessageLimit: true,
    },
  });

  let checked = 0;
  let remindersSent = 0;
  let markedPastDue = 0;
  let downgraded = 0;

  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  for (const company of companies) {
    checked += 1;

    if (!company.currentPeriodEnd) continue;

    for (const days of reminderDays()) {
      const reminderDate = addDays(company.currentPeriodEnd, -days);

      if (
        reminderDate >= todayStart &&
        reminderDate < todayEnd &&
        ["TRIALING", "ACTIVE"].includes(company.subscriptionStatus)
      ) {
        const event = await sendRenewalReminder({
          company,
          daysBeforeEnd: days,
        });

        if (event) remindersSent += 1;
      }
    }

    if (
      company.currentPeriodEnd < new Date() &&
      ["TRIALING", "ACTIVE"].includes(company.subscriptionStatus)
    ) {
      const event = await markPastDue({
        company,
      });

      if (event) markedPastDue += 1;
    }

    const downgradeEvent = await autoDowngradeCompany({
      company,
    });

    if (downgradeEvent) downgraded += 1;
  }

  return {
    checked,
    remindersSent,
    markedPastDue,
    downgraded,
  };
}

export async function manuallyExtendSubscriptionPeriod({
  companyId,
  actorUserId,
  days,
  reason,
}: {
  companyId: string;
  actorUserId?: string | null;
  days: number;
  reason?: string | null;
}) {
  if (days <= 0) {
    throw new Error("days must be greater than 0");
  }

  const company = await prisma.company.findUnique({
    where: {
      id: companyId,
    },
  });

  if (!company) {
    throw new Error("Company not found");
  }

  const baseDate =
    company.currentPeriodEnd && company.currentPeriodEnd > new Date()
      ? company.currentPeriodEnd
      : new Date();
  const newPeriodEnd = addDays(baseDate, days);

  await prisma.company.update({
    where: {
      id: companyId,
    },
    data: {
      subscriptionStatus: "ACTIVE",
      currentPeriodEnd: newPeriodEnd,
    },
  });

  const event = await createRenewalEvent({
    companyId,
    type: "MANUALLY_EXTENDED",
    billingPlan: company.billingPlan,
    subscriptionStatus: "ACTIVE",
    periodStart: company.currentPeriodStart,
    periodEnd: newPeriodEnd,
    message: `Subscription manually extended by ${days} day(s).`,
    metadata: {
      actorUserId,
      reason,
      previousPeriodEnd: company.currentPeriodEnd,
    },
  });

  await createAuditLog({
    companyId,
    actorUserId: actorUserId ?? undefined,
    action: "billing.subscription_manually_extended",
    entityType: "Company",
    entityId: companyId,
    metadata: safeJson({
      days,
      reason,
      newPeriodEnd,
      renewalEventId: event.id,
    }),
  }).catch(() => undefined);

  return event;
}

export async function listCompanySubscriptionRenewalEvents({
  companyId,
}: {
  companyId: string;
}) {
  return prisma.subscriptionRenewalEvent.findMany({
    where: {
      companyId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  });
}

export async function getSubscriptionRenewalHealth() {
  const [events24h, pastDueCompanies, paidCompaniesExpiring7d] =
    await Promise.all([
      prisma.subscriptionRenewalEvent.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.company.count({
        where: {
          subscriptionStatus: "PAST_DUE",
        },
      }),
      prisma.company.count({
        where: {
          billingPlan: {
            not: "FREE",
          },
          subscriptionStatus: {
            in: ["TRIALING", "ACTIVE"],
          },
          currentPeriodEnd: {
            gte: new Date(),
            lte: addDays(new Date(), 7),
          },
        },
      }),
    ]);

  return {
    enabled: isEnabled(),
    events24h,
    pastDueCompanies,
    paidCompaniesExpiring7d,
    graceDays: graceDays(),
    autoDowngradeAfterGrace: autoDowngradeAfterGrace(),
    isHealthy: isEnabled(),
  };
}
