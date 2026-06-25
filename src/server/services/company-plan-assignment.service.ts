import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";

export class CompanyPlanAssignmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompanyPlanAssignmentError";
  }
}

function enabled() {
  return process.env.COMPANY_PLAN_ASSIGNMENT_ENABLED !== "false";
}

function defaultPlanCode() {
  return process.env.DEFAULT_COMPANY_PLAN_CODE || "trial";
}

function defaultTrialDays() {
  const value = Number(process.env.DEFAULT_COMPANY_TRIAL_DAYS ?? 14);
  return Number.isFinite(value) && value > 0 ? value : 14;
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

function planNameFromCode(planCode: string) {
  const map: Record<string, string> = {
    trial: "Free Trial",
    starter: "Starter",
    growth: "Growth",
    business: "Business",
    enterprise: "Enterprise",
  };

  return map[planCode] ?? planCode;
}

function addDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function createPlanEvent({
  actorUserId,
  assignmentId,
  companyId,
  description,
  metadata,
  title,
  type,
}: {
  companyId: string;
  assignmentId: string;
  actorUserId?: string | null;
  type:
    | "CREATED"
    | "ACTIVATED"
    | "TRIAL_EXTENDED"
    | "PLAN_CHANGED"
    | "CANCELED"
    | "SUSPENDED"
    | "EXPIRED"
    | "REACTIVATED";
  title: string;
  description?: string | null;
  metadata?: unknown;
}) {
  const event = await prisma.companyPlanAssignmentEvent.create({
    data: {
      companyId,
      assignmentId,
      actorUserId: actorUserId ?? null,
      type,
      title,
      description: description ?? null,
      metadata: metadata ? safeJson(metadata) : undefined,
    },
  });

  await createAuditLog({
    companyId,
    actorUserId: actorUserId ?? undefined,
    action: `company_plan.${type.toLowerCase()}`,
    entityType: "CompanyPlanAssignment",
    entityId: assignmentId,
    metadata: safeJson({
      title,
      description,
      metadata,
    }),
  }).catch(() => undefined);

  return event;
}

export async function assignDefaultTrialPlan({
  actorUserId,
  companyId,
}: {
  companyId: string;
  actorUserId?: string | null;
}) {
  if (!enabled()) {
    return null;
  }

  const existing = await prisma.companyPlanAssignment.findFirst({
    where: {
      companyId,
      isCurrent: true,
    },
  });

  if (existing) {
    return existing;
  }

  const planCode = defaultPlanCode();
  const trialEndsAt = addDays(defaultTrialDays());
  const now = new Date();
  const assignment = await prisma.companyPlanAssignment.create({
    data: {
      companyId,
      planCode,
      planName: planNameFromCode(planCode),
      status: "TRIAL",
      source: "SIGNUP",
      isCurrent: true,
      startsAt: now,
      trialEndsAt,
      currentPeriodStartsAt: now,
      currentPeriodEndsAt: trialEndsAt,
      assignedByUserId: actorUserId ?? null,
      metadata: safeJson({
        defaultTrialDays: defaultTrialDays(),
      }),
    },
  });

  await createPlanEvent({
    companyId,
    assignmentId: assignment.id,
    actorUserId,
    type: "CREATED",
    title: "Default trial plan assigned",
    metadata: {
      planCode,
      trialEndsAt,
    },
  });

  return assignment;
}

export async function getCurrentCompanyPlan(companyId: string) {
  const assignment = await prisma.companyPlanAssignment.findFirst({
    where: {
      companyId,
      isCurrent: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!assignment) {
    return null;
  }

  const now = Date.now();

  if (
    assignment.status === "TRIAL" &&
    assignment.trialEndsAt &&
    assignment.trialEndsAt.getTime() < now
  ) {
    const expired = await prisma.companyPlanAssignment.update({
      where: {
        id: assignment.id,
      },
      data: {
        status: "EXPIRED",
      },
    });

    await createPlanEvent({
      companyId,
      assignmentId: assignment.id,
      type: "EXPIRED",
      title: "Trial plan expired",
    }).catch(() => undefined);

    return expired;
  }

  if (
    assignment.status === "ACTIVE" &&
    assignment.currentPeriodEndsAt &&
    assignment.currentPeriodEndsAt.getTime() < now
  ) {
    const expired = await prisma.companyPlanAssignment.update({
      where: {
        id: assignment.id,
      },
      data: {
        status: "EXPIRED",
      },
    });

    await createPlanEvent({
      companyId,
      assignmentId: assignment.id,
      type: "EXPIRED",
      title: "Plan period expired",
    }).catch(() => undefined);

    return expired;
  }

  return assignment;
}

export async function assertCompanyHasActivePlan(companyId: string) {
  const requireActiveAccess =
    process.env.COMPANY_PLAN_REQUIRE_ACTIVE_ACCESS !== "false";

  if (!requireActiveAccess) {
    return true;
  }

  const plan = await getCurrentCompanyPlan(companyId);

  if (!plan) {
    throw new CompanyPlanAssignmentError("No active plan assigned.");
  }

  if (!["TRIAL", "ACTIVE"].includes(plan.status)) {
    throw new CompanyPlanAssignmentError(
      `Company plan is ${plan.status.toLowerCase()}.`,
    );
  }

  return true;
}

export async function platformAssignCompanyPlan({
  actorUserId,
  companyId,
  days,
  planCode,
  status,
}: {
  companyId: string;
  actorUserId: string;
  planCode: string;
  status: "TRIAL" | "ACTIVE";
  days: number;
}) {
  if (!enabled()) {
    throw new CompanyPlanAssignmentError("Company plan assignment is disabled.");
  }

  if (!planCode.trim()) {
    throw new CompanyPlanAssignmentError("Plan code is required.");
  }

  if (!Number.isFinite(days) || days <= 0) {
    throw new CompanyPlanAssignmentError("Valid plan days are required.");
  }

  await prisma.companyPlanAssignment.updateMany({
    where: {
      companyId,
      isCurrent: true,
    },
    data: {
      isCurrent: false,
    },
  });

  const periodEndsAt = addDays(days);
  const now = new Date();
  const assignment = await prisma.companyPlanAssignment.create({
    data: {
      companyId,
      planCode: planCode.trim(),
      planName: planNameFromCode(planCode.trim()),
      status,
      source: "PLATFORM_ADMIN",
      isCurrent: true,
      startsAt: now,
      trialEndsAt: status === "TRIAL" ? periodEndsAt : null,
      currentPeriodStartsAt: now,
      currentPeriodEndsAt: periodEndsAt,
      assignedByUserId: actorUserId,
      metadata: safeJson({
        days,
      }),
    },
  });

  await createPlanEvent({
    companyId,
    assignmentId: assignment.id,
    actorUserId,
    type: status === "ACTIVE" ? "ACTIVATED" : "CREATED",
    title: `${assignment.planName} assigned by platform admin`,
    metadata: {
      planCode,
      status,
      days,
      periodEndsAt,
    },
  });

  return assignment;
}

export async function extendCompanyTrial({
  actorUserId,
  companyId,
  days,
}: {
  companyId: string;
  actorUserId: string;
  days: number;
}) {
  if (!Number.isFinite(days) || days <= 0) {
    throw new CompanyPlanAssignmentError("Valid extension days are required.");
  }

  const current = await getCurrentCompanyPlan(companyId);

  if (!current) {
    throw new CompanyPlanAssignmentError("No current plan found.");
  }

  const baseDate =
    current.trialEndsAt && current.trialEndsAt.getTime() > Date.now()
      ? current.trialEndsAt
      : new Date();
  const nextTrialEndsAt = new Date(
    baseDate.getTime() + days * 24 * 60 * 60 * 1000,
  );
  const updated = await prisma.companyPlanAssignment.update({
    where: {
      id: current.id,
    },
    data: {
      status: "TRIAL",
      trialEndsAt: nextTrialEndsAt,
      currentPeriodEndsAt: nextTrialEndsAt,
    },
  });

  await createPlanEvent({
    companyId,
    assignmentId: current.id,
    actorUserId,
    type: "TRIAL_EXTENDED",
    title: `Trial extended by ${days} days`,
    metadata: {
      days,
      nextTrialEndsAt,
    },
  });

  return updated;
}

export async function suspendCompanyPlan({
  actorUserId,
  companyId,
  reason,
}: {
  companyId: string;
  actorUserId: string;
  reason: string;
}) {
  if (!reason.trim()) {
    throw new CompanyPlanAssignmentError("Suspension reason is required.");
  }

  const current = await getCurrentCompanyPlan(companyId);

  if (!current) {
    throw new CompanyPlanAssignmentError("No current plan found.");
  }

  const updated = await prisma.companyPlanAssignment.update({
    where: {
      id: current.id,
    },
    data: {
      status: "SUSPENDED",
      suspendedAt: new Date(),
      suspensionReason: reason.trim(),
    },
  });

  await createPlanEvent({
    companyId,
    assignmentId: current.id,
    actorUserId,
    type: "SUSPENDED",
    title: "Company plan suspended",
    description: reason.trim(),
  });

  return updated;
}

export async function cancelCompanyPlan({
  actorUserId,
  companyId,
}: {
  companyId: string;
  actorUserId: string;
}) {
  const current = await getCurrentCompanyPlan(companyId);

  if (!current) {
    throw new CompanyPlanAssignmentError("No current plan found.");
  }

  const updated = await prisma.companyPlanAssignment.update({
    where: {
      id: current.id,
    },
    data: {
      status: "CANCELED",
      canceledAt: new Date(),
    },
  });

  await createPlanEvent({
    companyId,
    assignmentId: current.id,
    actorUserId,
    type: "CANCELED",
    title: "Company plan canceled",
  });

  return updated;
}

export async function getCompanyPlanAccessSummary(companyId: string) {
  const currentPlan = await getCurrentCompanyPlan(companyId);

  return {
    currentPlan,
    hasActiveAccess:
      currentPlan !== null && ["TRIAL", "ACTIVE"].includes(currentPlan.status),
  };
}

export async function getCompanyPlanAssignmentHealth() {
  const [currentPlans, trialPlans, activePlans, expiredPlans, suspendedPlans] =
    await Promise.all([
      prisma.companyPlanAssignment.count({
        where: {
          isCurrent: true,
        },
      }),
      prisma.companyPlanAssignment.count({
        where: {
          isCurrent: true,
          status: "TRIAL",
        },
      }),
      prisma.companyPlanAssignment.count({
        where: {
          isCurrent: true,
          status: "ACTIVE",
        },
      }),
      prisma.companyPlanAssignment.count({
        where: {
          isCurrent: true,
          status: "EXPIRED",
        },
      }),
      prisma.companyPlanAssignment.count({
        where: {
          isCurrent: true,
          status: "SUSPENDED",
        },
      }),
    ]);

  return {
    enabled: enabled(),
    currentPlans,
    trialPlans,
    activePlans,
    expiredPlans,
    suspendedPlans,
    isHealthy: enabled(),
  };
}
