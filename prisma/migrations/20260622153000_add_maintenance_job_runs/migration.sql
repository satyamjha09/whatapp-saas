CREATE TYPE "MaintenanceJobRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "MaintenanceJobRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "jobName" TEXT NOT NULL,
    "status" "MaintenanceJobRunStatus" NOT NULL DEFAULT 'RUNNING',
    "checkedCount" INTEGER NOT NULL DEFAULT 0,
    "recoveredCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MaintenanceJobRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MaintenanceJobRun_companyId_idx" ON "MaintenanceJobRun"("companyId");
CREATE INDEX "MaintenanceJobRun_jobName_idx" ON "MaintenanceJobRun"("jobName");
CREATE INDEX "MaintenanceJobRun_status_idx" ON "MaintenanceJobRun"("status");
CREATE INDEX "MaintenanceJobRun_startedAt_idx" ON "MaintenanceJobRun"("startedAt");

ALTER TABLE "MaintenanceJobRun"
ADD CONSTRAINT "MaintenanceJobRun_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
