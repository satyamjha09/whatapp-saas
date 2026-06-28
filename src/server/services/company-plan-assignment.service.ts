import { BillingPlan, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getBillingPlanConfig } from "@/server/config/billing-plans";
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

type PlanEventType =
  | "CREATED"
  | "ACTIVATED"
  | "TRIAL_EXTENDED"
  | "PLAN_CHANGED"
  | "CANCELED"
  | "SUSPENDED"
  | "EXPIRED"
  | "REACTIVATED";

type PlanAssignmentSnapshot = {
  id: string;
  companyId: string;
  planCode: string;
  status: "TRIAL" | "ACTIVE" | "EXPIRED" | "CANCELED" | "SUSPENDED";
  currentPeriodStartsAt: Date | null;
  currentPeriodEndsAt: Date | null;
  trialEndsAt: Date | null;
  canceledAt: Date | null;
};

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

function billingPlanFromPlanCode(planCode: string): BillingPlan {
  const normalized = planCode.trim().toUpperCase();

  if (normalized === "TRIAL") {
    return "FREE" as const;
  }

  if (
    normalized === "FREE" ||
    normalized === "STARTER" ||
    normalized === "GROWTH" ||
    normalized === "BUSINESS"
  ) {
    return normalized;
  }

  throw new CompanyPlanAssignmentError(
    `Plan code "${planCode}" cannot be mirrored to Company.billingPlan.`,
  );
}

function subscriptionStatusFromPlanStatus(
  status: PlanAssignmentSnapshot["status"],
) {
  if (status === "TRIAL") return "TRIALING" as const;
  if (status === "ACTIVE") return "ACTIVE" as const;
  if (status === "CANCELED") return "CANCELED" as const;

  return "PAST_DUE" as const;
}

function companyBillingSnapshotData(assignment: PlanAssignmentSnapshot) {
  const billingPlan = billingPlanFromPlanCode(assignment.planCode);
  const plan = getBillingPlanConfig(billingPlan);

  return {
    billingPlan,
    subscriptionStatus: subscriptionStatusFromPlanStatus(assignment.status),
    trialEndsAt: assignment.trialEndsAt,
    currentPeriodStart: assignment.currentPeriodStartsAt,
    currentPeriodEnd: assignment.currentPeriodEndsAt,
    monthlyMessageLimit: plan.monthlyMessageLimit,
    cancelAtPeriodEnd: false,
    subscriptionCanceledAt:
      assignment.status === "CANCELED"
        ? (assignment.canceledAt ?? new Date())
        : null,
  };
}

async function syncCompanyBillingSnapshotTx(
  tx: Prisma.TransactionClient,
  assignment: PlanAssignmentSnapshot,
) {
  return tx.company.update({
    where: {
      id: assignment.companyId,
    },
    data: companyBillingSnapshotData(assignment),
  });
}

async function createPlanEventRecord(
  tx: Prisma.TransactionClient,
  {
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
    type: PlanEventType;
    title: string;
    description?: string | null;
    metadata?: unknown;
  },
) {
  return tx.companyPlanAssignmentEvent.create({
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
}

async function createPlanAuditLog({
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
  type: PlanEventType;
  title: string;
  description?: string | null;
  metadata?: unknown;
}) {
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
    await prisma.$transaction(async (tx) => {
      await syncCompanyBillingSnapshotTx(tx, existing);
    });

    return existing;
  }

  const planCode = defaultPlanCode();
  const trialEndsAt = addDays(defaultTrialDays());
  const now = new Date();
  const assignment = await prisma.$transaction(async (tx) => {
    const created = await tx.companyPlanAssignment.create({
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

    await syncCompanyBillingSnapshotTx(tx, created);
    await createPlanEventRecord(tx, {
      companyId,
      assignmentId: created.id,
      actorUserId,
      type: "CREATED",
      title: "Default trial plan assigned",
      metadata: {
        planCode,
        trialEndsAt,
      },
    });

    return created;
  });

  await createPlanAuditLog({
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
    const expired = await prisma.$transaction(async (tx) => {
      const updated = await tx.companyPlanAssignment.update({
        where: {
          id: assignment.id,
        },
        data: {
          status: "EXPIRED",
        },
      });

      await syncCompanyBillingSnapshotTx(tx, updated);
      await createPlanEventRecord(tx, {
        companyId,
        assignmentId: assignment.id,
        type: "EXPIRED",
        title: "Trial plan expired",
      });

      return updated;
    });

    await createPlanAuditLog({
      companyId,
      assignmentId: expired.id,
      type: "EXPIRED",
      title: "Trial plan expired",
    });

    return expired;
  }

  if (
    assignment.status === "ACTIVE" &&
    assignment.currentPeriodEndsAt &&
    assignment.currentPeriodEndsAt.getTime() < now
  ) {
    const expired = await prisma.$transaction(async (tx) => {
      const updated = await tx.companyPlanAssignment.update({
        where: {
          id: assignment.id,
        },
        data: {
          status: "EXPIRED",
        },
      });

      await syncCompanyBillingSnapshotTx(tx, updated);
      await createPlanEventRecord(tx, {
        companyId,
        assignmentId: assignment.id,
        type: "EXPIRED",
        title: "Plan period expired",
      });

      return updated;
    });

    await createPlanAuditLog({
      companyId,
      assignmentId: expired.id,
      type: "EXPIRED",
      title: "Plan period expired",
    });

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

  let plan = await getCurrentCompanyPlan(companyId);

  if (!plan) {
    plan = await assignDefaultTrialPlan({
      companyId,
    });
  }

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

  const periodEndsAt = addDays(days);
  const now = new Date();
  const normalizedPlanCode = planCode.trim();
  const assignment = await prisma.$transaction(async (tx) => {
    await tx.companyPlanAssignment.updateMany({
      where: {
        companyId,
        isCurrent: true,
      },
      data: {
        isCurrent: false,
      },
    });

    const created = await tx.companyPlanAssignment.create({
      data: {
        companyId,
        planCode: normalizedPlanCode,
        planName: planNameFromCode(normalizedPlanCode),
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

    await syncCompanyBillingSnapshotTx(tx, created);
    await createPlanEventRecord(tx, {
      companyId,
      assignmentId: created.id,
      actorUserId,
      type: status === "ACTIVE" ? "ACTIVATED" : "CREATED",
      title: `${created.planName} assigned by platform admin`,
      metadata: {
        planCode: normalizedPlanCode,
        status,
        days,
        periodEndsAt,
      },
    });

    return created;
  });

  await createPlanAuditLog({
    companyId,
    assignmentId: assignment.id,
    actorUserId,
    type: status === "ACTIVE" ? "ACTIVATED" : "CREATED",
    title: `${assignment.planName} assigned by platform admin`,
    metadata: {
      planCode: normalizedPlanCode,
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
  const updated = await prisma.$transaction(async (tx) => {
    const assignment = await tx.companyPlanAssignment.update({
      where: {
        id: current.id,
      },
      data: {
        status: "TRIAL",
        trialEndsAt: nextTrialEndsAt,
        currentPeriodEndsAt: nextTrialEndsAt,
      },
    });

    await syncCompanyBillingSnapshotTx(tx, assignment);
    await createPlanEventRecord(tx, {
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

    return assignment;
  });

  await createPlanAuditLog({
    companyId,
    assignmentId: updated.id,
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

  const updated = await prisma.$transaction(async (tx) => {
    const assignment = await tx.companyPlanAssignment.update({
      where: {
        id: current.id,
      },
      data: {
        status: "SUSPENDED",
        suspendedAt: new Date(),
        suspensionReason: reason.trim(),
      },
    });

    await syncCompanyBillingSnapshotTx(tx, assignment);
    await createPlanEventRecord(tx, {
      companyId,
      assignmentId: current.id,
      actorUserId,
      type: "SUSPENDED",
      title: "Company plan suspended",
      description: reason.trim(),
    });

    return assignment;
  });

  await createPlanAuditLog({
    companyId,
    assignmentId: updated.id,
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

  const canceledAt = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const assignment = await tx.companyPlanAssignment.update({
      where: {
        id: current.id,
      },
      data: {
        status: "CANCELED",
        canceledAt,
      },
    });

    await syncCompanyBillingSnapshotTx(tx, assignment);
    await createPlanEventRecord(tx, {
      companyId,
      assignmentId: current.id,
      actorUserId,
      type: "CANCELED",
      title: "Company plan canceled",
    });

    return assignment;
  });

  await createPlanAuditLog({
    companyId,
    assignmentId: updated.id,
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

export async function syncCompanyBillingSnapshotFromPlanAssignment(
  companyId: string,
) {
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
    throw new CompanyPlanAssignmentError("No current plan assignment found.");
  }

  return prisma.$transaction(async (tx) => {
    await syncCompanyBillingSnapshotTx(tx, assignment);
    return assignment;
  });
}

export async function getCompanyPlanSnapshotMismatches({
  limit = 500,
}: {
  limit?: number;
} = {}) {
  const assignments = await prisma.companyPlanAssignment.findMany({
    where: {
      isCurrent: true,
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          billingPlan: true,
          subscriptionStatus: true,
          trialEndsAt: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          monthlyMessageLimit: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: limit,
  });

  return assignments.flatMap((assignment) => {
    const expected = companyBillingSnapshotData(assignment);
    const company = assignment.company;
    const mismatches: Array<{
      field: string;
      expected: string | number | null;
      actual: string | number | null;
    }> = [];

    const compare = (
      field: string,
      expectedValue: string | number | Date | null,
      actualValue: string | number | Date | null,
    ) => {
      const normalize = (value: string | number | Date | null) =>
        value instanceof Date ? value.toISOString() : value;
      const expectedNormalized = normalize(expectedValue);
      const actualNormalized = normalize(actualValue);

      if (expectedNormalized !== actualNormalized) {
        mismatches.push({
          field,
          expected: expectedNormalized,
          actual: actualNormalized,
        });
      }
    };

    compare("billingPlan", expected.billingPlan, company.billingPlan);
    compare(
      "subscriptionStatus",
      expected.subscriptionStatus,
      company.subscriptionStatus,
    );
    compare("trialEndsAt", expected.trialEndsAt, company.trialEndsAt);
    compare(
      "currentPeriodStart",
      expected.currentPeriodStart,
      company.currentPeriodStart,
    );
    compare("currentPeriodEnd", expected.currentPeriodEnd, company.currentPeriodEnd);
    compare(
      "monthlyMessageLimit",
      expected.monthlyMessageLimit,
      company.monthlyMessageLimit,
    );

    if (mismatches.length === 0) {
      return [];
    }

    return [
      {
        companyId: company.id,
        companyName: company.name,
        assignmentId: assignment.id,
        planCode: assignment.planCode,
        status: assignment.status,
        mismatches,
      },
    ];
  });
}

export async function getCompanyPlanAssignmentHealth() {
  const [
    currentPlans,
    trialPlans,
    activePlans,
    expiredPlans,
    suspendedPlans,
    snapshotMismatches,
  ] =
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
      getCompanyPlanSnapshotMismatches({ limit: 50 }),
    ]);

  return {
    enabled: enabled(),
    currentPlans,
    trialPlans,
    activePlans,
    expiredPlans,
    suspendedPlans,
    snapshotMismatchCount: snapshotMismatches.length,
    isHealthy: enabled() && snapshotMismatches.length === 0,
  };
}
