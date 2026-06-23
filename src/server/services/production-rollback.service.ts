import { prisma } from "@/lib/prisma";

export async function startProductionRollback({
  fromCommitSha,
  toCommitSha,
  toRef,
  branch,
  appUrl,
}: {
  fromCommitSha?: string | null;
  toCommitSha?: string | null;
  toRef?: string | null;
  branch?: string | null;
  appUrl?: string | null;
}) {
  return prisma.productionRollback.create({
    data: {
      status: "RUNNING",
      fromCommitSha,
      toCommitSha,
      toRef,
      branch,
      appUrl,
      startedAt: new Date(),
    },
  });
}

export async function markProductionRollbackStep({
  rollbackId,
  step,
  backupRunId,
}: {
  rollbackId: string;
  step:
    | "maintenanceEnabledAt"
    | "backupCompletedAt"
    | "checkoutCompletedAt"
    | "installCompletedAt"
    | "prismaGeneratedAt"
    | "buildCompletedAt"
    | "pm2RestartedAt"
    | "healthCheckPassedAt"
    | "deepHealthCheckPassedAt"
    | "maintenanceDisabledAt";
  backupRunId?: string | null;
}) {
  return prisma.productionRollback.update({
    where: {
      id: rollbackId,
    },
    data: {
      [step]: new Date(),
      ...(backupRunId ? { backupRunId } : {}),
    },
  });
}

export async function completeProductionRollback({
  rollbackId,
}: {
  rollbackId: string;
}) {
  return prisma.productionRollback.update({
    where: {
      id: rollbackId,
    },
    data: {
      status: "SUCCEEDED",
      completedAt: new Date(),
    },
  });
}

export async function failProductionRollback({
  rollbackId,
  errorStage,
  errorMessage,
}: {
  rollbackId: string;
  errorStage: string;
  errorMessage: string;
}) {
  return prisma.productionRollback.update({
    where: {
      id: rollbackId,
    },
    data: {
      status: "FAILED",
      errorStage,
      errorMessage: errorMessage.slice(0, 2000),
      completedAt: new Date(),
    },
  });
}

export async function getProductionRollbackHistory({
  limit = 10,
}: {
  limit?: number;
} = {}) {
  return prisma.productionRollback.findMany({
    orderBy: {
      startedAt: "desc",
    },
    take: limit,
  });
}
