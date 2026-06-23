import { prisma } from "@/lib/prisma";

export async function startProductionDeployment({
  commitSha,
  commitMessage,
  branch,
  appUrl,
}: {
  commitSha?: string | null;
  commitMessage?: string | null;
  branch?: string | null;
  appUrl?: string | null;
}) {
  return prisma.productionDeployment.create({
    data: {
      status: "RUNNING",
      commitSha,
      commitMessage,
      branch,
      appUrl,
      startedAt: new Date(),
    },
  });
}

export async function markProductionDeploymentStep({
  deploymentId,
  step,
  backupRunId,
}: {
  deploymentId: string;
  step:
    | "maintenanceEnabledAt"
    | "backupCompletedAt"
    | "migrationCompletedAt"
    | "prismaGeneratedAt"
    | "buildCompletedAt"
    | "pm2RestartedAt"
    | "healthCheckPassedAt"
    | "deepHealthCheckPassedAt"
    | "maintenanceDisabledAt";
  backupRunId?: string | null;
}) {
  return prisma.productionDeployment.update({
    where: {
      id: deploymentId,
    },
    data: {
      [step]: new Date(),
      ...(backupRunId ? { backupRunId } : {}),
    },
  });
}

export async function completeProductionDeployment({
  deploymentId,
}: {
  deploymentId: string;
}) {
  return prisma.productionDeployment.update({
    where: {
      id: deploymentId,
    },
    data: {
      status: "SUCCEEDED",
      completedAt: new Date(),
    },
  });
}

export async function failProductionDeployment({
  deploymentId,
  errorStage,
  errorMessage,
}: {
  deploymentId: string;
  errorStage: string;
  errorMessage: string;
}) {
  return prisma.productionDeployment.update({
    where: {
      id: deploymentId,
    },
    data: {
      status: "FAILED",
      errorStage,
      errorMessage: errorMessage.slice(0, 2000),
      completedAt: new Date(),
    },
  });
}

export async function getProductionDeploymentHistory({
  limit = 10,
}: {
  limit?: number;
} = {}) {
  return prisma.productionDeployment.findMany({
    orderBy: {
      startedAt: "desc",
    },
    take: limit,
  });
}

export async function getLatestProductionDeployment() {
  return prisma.productionDeployment.findFirst({
    orderBy: {
      startedAt: "desc",
    },
  });
}
