-- CreateEnum
CREATE TYPE "DatabaseRestoreRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "DatabaseRestoreRun" (
    "id" TEXT NOT NULL,
    "status" "DatabaseRestoreRunStatus" NOT NULL DEFAULT 'RUNNING',
    "sourceFileName" TEXT,
    "sourceFilePath" TEXT,
    "checksumSha256" TEXT,
    "preRestoreBackupRunId" TEXT,
    "operationLockOwner" TEXT,
    "localLogPath" TEXT,
    "maintenanceEnabledAt" TIMESTAMP(3),
    "preRestoreBackupCreatedAt" TIMESTAMP(3),
    "checksumVerifiedAt" TIMESTAMP(3),
    "pm2StoppedAt" TIMESTAMP(3),
    "restoreStartedAt" TIMESTAMP(3),
    "restoreCompletedAt" TIMESTAMP(3),
    "migrationCompletedAt" TIMESTAMP(3),
    "prismaGeneratedAt" TIMESTAMP(3),
    "pm2RestartedAt" TIMESTAMP(3),
    "healthCheckPassedAt" TIMESTAMP(3),
    "deepHealthCheckPassedAt" TIMESTAMP(3),
    "maintenanceDisabledAt" TIMESTAMP(3),
    "errorStage" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatabaseRestoreRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DatabaseRestoreRun_status_idx" ON "DatabaseRestoreRun"("status");

-- CreateIndex
CREATE INDEX "DatabaseRestoreRun_startedAt_idx" ON "DatabaseRestoreRun"("startedAt");
