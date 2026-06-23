-- CreateEnum
CREATE TYPE "ProductionDeploymentStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "ProductionDeployment" (
    "id" TEXT NOT NULL,
    "status" "ProductionDeploymentStatus" NOT NULL DEFAULT 'RUNNING',
    "commitSha" TEXT,
    "commitMessage" TEXT,
    "branch" TEXT,
    "appUrl" TEXT,
    "backupRunId" TEXT,
    "maintenanceEnabledAt" TIMESTAMP(3),
    "backupCompletedAt" TIMESTAMP(3),
    "migrationCompletedAt" TIMESTAMP(3),
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

    CONSTRAINT "ProductionDeployment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductionDeployment_status_idx" ON "ProductionDeployment"("status");

-- CreateIndex
CREATE INDEX "ProductionDeployment_commitSha_idx" ON "ProductionDeployment"("commitSha");

-- CreateIndex
CREATE INDEX "ProductionDeployment_startedAt_idx" ON "ProductionDeployment"("startedAt");
