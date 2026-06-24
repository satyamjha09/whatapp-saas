import {
  BillingPlan,
  Prisma,
  ScheduledPlanChangeStatus,
  ScheduledPlanChangeType,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getBillingPlanConfig } from "@/server/config/billing-plans";
import { createAuditLog } from "@/server/services/audit.service";
import { createCompanyNotification } from "@/server/services/company-notification.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";

export class ScheduledPlanChangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScheduledPlanChangeError";
  }
}

function isEnabled() {
  return process.env.PLAN_CHANGE_SCHEDULER_ENABLED !== "false";
}

function allowSelfServeCancel() {
  return process.env.PLAN_CHANGE_ALLOW_SELF_SERVE_CANCEL !== "false";
}

function allowSelfServeDowngrade() {
  return process.env.PLAN_CHANGE_ALLOW_SELF_SERVE_DOWNGRADE !== "false";
}

function defaultDowngradePlan(): BillingPlan {
  const configuredPlan = process.env.PLAN_CHANGE_DEFAULT_DOWNGRADE_PLAN as
    | BillingPlan
    | undefined;

  return configuredPlan || "FREE";
}

function freeMonthlyMessageLimit() {
  const parsed = Number(process.env.PLAN_CHANGE_FREE_MONTHLY_MESSAGE_LIMIT ?? 100);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 100;
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(redactSensitiveData(value))) as Prisma.InputJsonValue;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

async function cancelExistingScheduledChanges({
  tx,
  companyId,
  reason,
}: {
  tx: Prisma.TransactionClient;
  companyId: string;
  reason: string;
}) {
  await tx.scheduledPlanChange.updateMany({
    where: {
      companyId,
      status: "SCHEDULED",
    },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      reason,
    },
  });
}

export async function schedulePlanCancellation({
  companyId,
  requestedByUserId,
  reason,
}: {
  companyId: string;
  requestedByUserId?: string | null;
  reason?: string | null;
}) {
  if (!isEnabled()) {
    throw new ScheduledPlanChangeError("Plan change scheduler is disabled.");
  }

  if (!allowSelfServeCancel()) {
    throw new ScheduledPlanChangeError("Self-serve cancellation is disabled.");
  }

  const company = await prisma.company.findUnique({
    where: {
      id: companyId,
    },
  });

  if (!company) {
    throw new ScheduledPlanChangeError("Company not found.");
  }

  if (company.billingPlan === "FREE") {
    throw new ScheduledPlanChangeError("FREE plan cannot be cancelled.");
  }

  const scheduledFor = company.currentPeriodEnd ?? addDays(new Date(), 30);
  const toPlan = defaultDowngradePlan();

  const result = await prisma.$transaction(async (tx) => {
    await cancelExistingScheduledChanges({
      tx,
      companyId,
      reason: "replaced-by-new-cancellation",
    });

    await tx.company.update({
      where: {
        id: companyId,
      },
      data: {
        cancelAtPeriodEnd: true,
        subscriptionCanceledAt: new Date(),
      },
    });

    return tx.scheduledPlanChange.create({
      data: {
        companyId,
        requestedByUserId: requestedByUserId ?? null,
        type: "CANCEL_AT_PERIOD_END",
        status: "SCHEDULED",
        fromPlan: company.billingPlan,
        toPlan,
        currentPeriodEnd: company.currentPeriodEnd,
        scheduledFor,
        reason: reason ?? "self-serve-cancellation",
        metadata: safeJson({
          previousSubscriptionStatus: company.subscriptionStatus,
          previousMonthlyMessageLimit: company.monthlyMessageLimit,
        }),
      },
    });
  });

  await createAuditLog({
    companyId,
    actorUserId: requestedByUserId ?? undefined,
    action: "billing.plan_cancellation_scheduled",
    entityType: "ScheduledPlanChange",
    entityId: result.id,
    metadata: safeJson({
      fromPlan: result.fromPlan,
      toPlan: result.toPlan,
      scheduledFor: result.scheduledFor,
    }),
  }).catch(() => undefined);

  await createCompanyNotification({
    companyId,
    type: "BILLING",
    severity: "WARNING",
    title: "Plan cancellation scheduled",
    message: `Your ${company.billingPlan} plan will remain active until ${scheduledFor.toLocaleDateString()} and then downgrade to ${result.toPlan}.`,
    actionHref: "/dashboard/billing/subscription",
    idempotencyKey: `plan-cancellation-scheduled:${result.id}`,
    metadata: safeJson({
      scheduledPlanChangeId: result.id,
      scheduledFor,
    }),
  }).catch(() => undefined);

  return result;
}

export async function schedulePlanDowngrade({
  companyId,
  requestedByUserId,
  toPlan,
  reason,
}: {
  companyId: string;
  requestedByUserId?: string | null;
  toPlan: BillingPlan;
  reason?: string | null;
}) {
  if (!isEnabled()) {
    throw new ScheduledPlanChangeError("Plan change scheduler is disabled.");
  }

  if (!allowSelfServeDowngrade()) {
    throw new ScheduledPlanChangeError("Self-serve downgrade is disabled.");
  }

  const company = await prisma.company.findUnique({
    where: {
      id: companyId,
    },
  });

  if (!company) {
    throw new ScheduledPlanChangeError("Company not found.");
  }

  if (company.billingPlan === toPlan) {
    throw new ScheduledPlanChangeError(`Company is already on ${toPlan}.`);
  }

  if (company.billingPlan === "FREE") {
    throw new ScheduledPlanChangeError("FREE plan cannot be downgraded.");
  }

  const scheduledFor = company.currentPeriodEnd ?? addDays(new Date(), 30);

  const result = await prisma.$transaction(async (tx) => {
    await cancelExistingScheduledChanges({
      tx,
      companyId,
      reason: "replaced-by-new-downgrade",
    });

    await tx.company.update({
      where: {
        id: companyId,
      },
      data: {
        cancelAtPeriodEnd: toPlan === "FREE",
        subscriptionCanceledAt: toPlan === "FREE" ? new Date() : null,
      },
    });

    return tx.scheduledPlanChange.create({
      data: {
        companyId,
        requestedByUserId: requestedByUserId ?? null,
        type:
          toPlan === "FREE"
            ? "DOWNGRADE_AT_PERIOD_END"
            : "PLAN_CHANGE_AT_PERIOD_END",
        status: "SCHEDULED",
        fromPlan: company.billingPlan,
        toPlan,
        currentPeriodEnd: company.currentPeriodEnd,
        scheduledFor,
        reason: reason ?? "self-serve-downgrade",
        metadata: safeJson({
          previousSubscriptionStatus: company.subscriptionStatus,
          previousMonthlyMessageLimit: company.monthlyMessageLimit,
        }),
      },
    });
  });

  await createAuditLog({
    companyId,
    actorUserId: requestedByUserId ?? undefined,
    action: "billing.plan_downgrade_scheduled",
    entityType: "ScheduledPlanChange",
    entityId: result.id,
    metadata: safeJson({
      fromPlan: result.fromPlan,
      toPlan: result.toPlan,
      scheduledFor: result.scheduledFor,
    }),
  }).catch(() => undefined);

  await createCompanyNotification({
    companyId,
    type: "BILLING",
    severity: "WARNING",
    title: "Plan downgrade scheduled",
    message: `Your ${company.billingPlan} plan will remain active until ${scheduledFor.toLocaleDateString()} and then change to ${result.toPlan}.`,
    actionHref: "/dashboard/billing/subscription",
    idempotencyKey: `plan-downgrade-scheduled:${result.id}`,
    metadata: safeJson({
      scheduledPlanChangeId: result.id,
      scheduledFor,
    }),
  }).catch(() => undefined);

  return result;
}

export async function cancelScheduledPlanChange({
  companyId,
  requestedByUserId,
}: {
  companyId: string;
  requestedByUserId?: string | null;
}) {
  const activeChange = await prisma.scheduledPlanChange.findFirst({
    where: {
      companyId,
      status: "SCHEDULED",
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!activeChange) {
    throw new ScheduledPlanChangeError("No scheduled plan change found.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedChange = await tx.scheduledPlanChange.update({
      where: {
        id: activeChange.id,
      },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        reason: "cancelled-by-user",
      },
    });

    await tx.company.update({
      where: {
        id: companyId,
      },
      data: {
        cancelAtPeriodEnd: false,
        subscriptionCanceledAt: null,
      },
    });

    return updatedChange;
  });

  await createAuditLog({
    companyId,
    actorUserId: requestedByUserId ?? undefined,
    action: "billing.scheduled_plan_change_cancelled",
    entityType: "ScheduledPlanChange",
    entityId: activeChange.id,
    metadata: safeJson({
      type: activeChange.type,
      fromPlan: activeChange.fromPlan,
      toPlan: activeChange.toPlan,
    }),
  }).catch(() => undefined);

  await createCompanyNotification({
    companyId,
    type: "BILLING",
    severity: "SUCCESS",
    title: "Scheduled plan change cancelled",
    message: "Your subscription will continue normally.",
    actionHref: "/dashboard/billing/subscription",
    idempotencyKey: `scheduled-plan-change-cancelled:${activeChange.id}`,
  }).catch(() => undefined);

  return result;
}

function monthlyMessageLimitForPlan(plan: BillingPlan) {
  if (plan === "FREE") return freeMonthlyMessageLimit();

  const planConfig = getBillingPlanConfig(plan);

  return planConfig.monthlyMessageLimit;
}

export async function applyScheduledPlanChange({
  scheduledPlanChangeId,
}: {
  scheduledPlanChangeId: string;
}) {
  const change = await prisma.scheduledPlanChange.findUnique({
    where: {
      id: scheduledPlanChangeId,
    },
    include: {
      company: true,
    },
  });

  if (!change || change.status !== "SCHEDULED") {
    return null;
  }

  const toPlan = change.toPlan ?? defaultDowngradePlan();
  const previousMonthlyMessageLimit = change.company.monthlyMessageLimit;
  const newMonthlyMessageLimit = monthlyMessageLimitForPlan(toPlan);
  const now = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: {
          id: change.companyId,
        },
        data: {
          billingPlan: toPlan,
          subscriptionStatus: "ACTIVE",
          monthlyMessageLimit: newMonthlyMessageLimit,
          cancelAtPeriodEnd: false,
          subscriptionCanceledAt: null,
          currentPeriodStart: now,
          currentPeriodEnd: addDays(now, 30),
        },
      });

      const planChange = await tx.companyPlanChange.create({
        data: {
          companyId: change.companyId,
          fromPlan: change.fromPlan,
          toPlan,
          source: "SYSTEM",
          previousMonthlyMessageLimit,
          newMonthlyMessageLimit,
          reason: "scheduled-plan-change-applied",
          metadata: safeJson({
            scheduledPlanChangeId: change.id,
            scheduledFor: change.scheduledFor,
            type: change.type,
          }),
        },
      });

      const updatedChange = await tx.scheduledPlanChange.update({
        where: {
          id: change.id,
        },
        data: {
          status: "APPLIED",
          appliedAt: new Date(),
        },
      });

      return {
        planChange,
        scheduledPlanChange: updatedChange,
      };
    });

    await createAuditLog({
      companyId: change.companyId,
      action: "billing.scheduled_plan_change_applied",
      entityType: "ScheduledPlanChange",
      entityId: change.id,
      metadata: safeJson({
        fromPlan: change.fromPlan,
        toPlan,
        planChangeId: result.planChange.id,
      }),
    }).catch(() => undefined);

    await createCompanyNotification({
      companyId: change.companyId,
      type: "BILLING",
      severity: "INFO",
      title: "Plan changed",
      message: `Your plan has changed from ${change.fromPlan} to ${toPlan}.`,
      actionHref: "/dashboard/billing",
      idempotencyKey: `scheduled-plan-change-applied:${change.id}`,
      metadata: safeJson({
        scheduledPlanChangeId: change.id,
        planChangeId: result.planChange.id,
      }),
    }).catch(() => undefined);

    return result;
  } catch (error) {
    await prisma.scheduledPlanChange.update({
      where: {
        id: change.id,
      },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        failureReason:
          error instanceof Error
            ? error.message
            : "Unknown scheduled plan change error",
      },
    });

    throw error;
  }
}

export async function scanScheduledPlanChanges() {
  if (!isEnabled()) {
    return {
      skipped: true,
      reason: "Plan change scheduler disabled",
    };
  }

  const dueChanges = await prisma.scheduledPlanChange.findMany({
    where: {
      status: "SCHEDULED",
      scheduledFor: {
        lte: new Date(),
      },
    },
    orderBy: {
      scheduledFor: "asc",
    },
    take: 100,
  });

  let applied = 0;
  let failed = 0;

  for (const change of dueChanges) {
    try {
      const result = await applyScheduledPlanChange({
        scheduledPlanChangeId: change.id,
      });

      if (result) applied += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    checked: dueChanges.length,
    applied,
    failed,
  };
}

export async function getCompanyScheduledPlanChange({
  companyId,
}: {
  companyId: string;
}) {
  return prisma.scheduledPlanChange.findFirst({
    where: {
      companyId,
      status: "SCHEDULED",
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
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

export async function listCompanyScheduledPlanChanges({
  companyId,
}: {
  companyId: string;
}) {
  return prisma.scheduledPlanChange.findMany({
    where: {
      companyId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
    include: {
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

export async function getScheduledPlanChangeHealth() {
  const [scheduled, applied24h, failed24h] = await Promise.all([
    prisma.scheduledPlanChange.count({
      where: {
        status: "SCHEDULED",
      },
    }),
    prisma.scheduledPlanChange.count({
      where: {
        status: "APPLIED",
        appliedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.scheduledPlanChange.count({
      where: {
        status: "FAILED",
        failedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  return {
    enabled: isEnabled(),
    scheduled,
    applied24h,
    failed24h,
    isHealthy: isEnabled() && failed24h === 0,
  };
}

export type ScheduledPlanChangeListItem = Awaited<
  ReturnType<typeof listCompanyScheduledPlanChanges>
>[number];

export type ScheduledPlanChangeHealth = Awaited<
  ReturnType<typeof getScheduledPlanChangeHealth>
>;

export type ScheduledPlanChangeKind = ScheduledPlanChangeType;
export type ScheduledPlanChangeState = ScheduledPlanChangeStatus;
