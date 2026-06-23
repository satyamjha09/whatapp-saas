-- CreateEnum
CREATE TYPE "ProductionRollbackStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "ProductionRollback" (
    "id" TEXT NOT NULL,
    "status" "ProductionRollbackStatus" NOT NULL DEFAULT 'RUNNING',
    "fromCommitSha" TEXT,
    "toCommitSha" TEXT,
    "toRef" TEXT,
    "branch" TEXT,
    "appUrl" TEXT,
    "backupRunId" TEXT,
    "maintenanceEnabledAt" TIMESTAMP(3),
    "backupCompletedAt" TIMESTAMP(3),
    "checkoutCompletedAt" TIMESTAMP(3),
    "installCompletedAt" TIMESTAMP(3),
    "prismaGeneratedAt" TIMESTAMP(3),
    "buildCompletedAt" TIMESTAMP(3),
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

    CONSTRAINT "ProductionRollback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductionRollback_status_idx" ON "ProductionRollback"("status");

-- CreateIndex
CREATE INDEX "ProductionRollback_fromCommitSha_idx" ON "ProductionRollback"("fromCommitSha");

-- CreateIndex
CREATE INDEX "ProductionRollback_toCommitSha_idx" ON "ProductionRollback"("toCommitSha");

-- CreateIndex
CREATE INDEX "ProductionRollback_startedAt_idx" ON "ProductionRollback"("startedAt");
