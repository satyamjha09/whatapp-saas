import { prisma } from "@/lib/prisma";

export async function recordDatabaseRestoreRun({
  status,
  sourceFileName,
  sourceFilePath,
  checksumSha256,
  preRestoreBackupRunId,
  operationLockOwner,
  localLogPath,
  maintenanceEnabledAt,
  preRestoreBackupCreatedAt,
  checksumVerifiedAt,
  pm2StoppedAt,
  restoreStartedAt,
  restoreCompletedAt,
  migrationCompletedAt,
  prismaGeneratedAt,
  pm2RestartedAt,
  healthCheckPassedAt,
  deepHealthCheckPassedAt,
  maintenanceDisabledAt,
  errorStage,
  errorMessage,
  startedAt,
  completedAt,
}: {
  status: "RUNNING" | "SUCCEEDED" | "FAILED";
  sourceFileName?: string | null;
  sourceFilePath?: string | null;
  checksumSha256?: string | null;
  preRestoreBackupRunId?: string | null;
  operationLockOwner?: string | null;
  localLogPath?: string | null;
  maintenanceEnabledAt?: Date | null;
  preRestoreBackupCreatedAt?: Date | null;
  checksumVerifiedAt?: Date | null;
  pm2StoppedAt?: Date | null;
  restoreStartedAt?: Date | null;
  restoreCompletedAt?: Date | null;
  migrationCompletedAt?: Date | null;
  prismaGeneratedAt?: Date | null;
  pm2RestartedAt?: Date | null;
  healthCheckPassedAt?: Date | null;
  deepHealthCheckPassedAt?: Date | null;
  maintenanceDisabledAt?: Date | null;
  errorStage?: string | null;
  errorMessage?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
}) {
  return prisma.databaseRestoreRun.create({
    data: {
      status,
      sourceFileName,
      sourceFilePath,
      checksumSha256,
      preRestoreBackupRunId,
      operationLockOwner,
      localLogPath,
      maintenanceEnabledAt,
      preRestoreBackupCreatedAt,
      checksumVerifiedAt,
      pm2StoppedAt,
      restoreStartedAt,
      restoreCompletedAt,
      migrationCompletedAt,
      prismaGeneratedAt,
      pm2RestartedAt,
      healthCheckPassedAt,
      deepHealthCheckPassedAt,
      maintenanceDisabledAt,
      errorStage,
      errorMessage: errorMessage ? errorMessage.slice(0, 2000) : null,
      startedAt: startedAt ?? new Date(),
      completedAt,
    },
  });
}

export async function getDatabaseRestoreHistory({
  limit = 10,
}: {
  limit?: number;
} = {}) {
  return prisma.databaseRestoreRun.findMany({
    orderBy: {
      startedAt: "desc",
    },
    take: limit,
  });
}
