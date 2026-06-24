-- CreateEnum
CREATE TYPE "DataRetentionEntityType" AS ENUM ('MESSAGE_EVENT', 'PROVIDER_WEBHOOK_EVENT', 'SECURITY_EVENT', 'STATUS_PAGE_EMAIL_DELIVERY', 'PUBLIC_PRIVACY_VERIFICATION', 'PRIVACY_REQUEST', 'AUDIT_LOG');

-- CreateEnum
CREATE TYPE "DataRetentionPolicyStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED');

-- CreateEnum
CREATE TYPE "DataRetentionRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DataRetentionAction" AS ENUM ('DELETE', 'ANONYMIZE', 'SKIP');

-- CreateEnum
CREATE TYPE "LegalHoldEntityType" AS ENUM ('CONTACT', 'COMPANY', 'MESSAGE', 'PRIVACY_REQUEST', 'INCIDENT');

-- CreateTable
CREATE TABLE "DataRetentionPolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "entityType" "DataRetentionEntityType" NOT NULL,
    "status" "DataRetentionPolicyStatus" NOT NULL DEFAULT 'ACTIVE',
    "retentionDays" INTEGER NOT NULL,
    "action" "DataRetentionAction" NOT NULL DEFAULT 'DELETE',
    "description" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataRetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataRetentionRun" (
    "id" TEXT NOT NULL,
    "status" "DataRetentionRunStatus" NOT NULL DEFAULT 'RUNNING',
    "dryRun" BOOLEAN NOT NULL DEFAULT true,
    "checkedCount" INTEGER NOT NULL DEFAULT 0,
    "deletedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataRetentionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataRetentionRunItem" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "companyId" TEXT,
    "policyId" TEXT,
    "entityType" "DataRetentionEntityType" NOT NULL,
    "action" "DataRetentionAction" NOT NULL,
    "checkedCount" INTEGER NOT NULL DEFAULT 0,
    "deletedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "cutoffAt" TIMESTAMP(3) NOT NULL,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataRetentionRunItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalHold" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "entityType" "LegalHoldEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "releasedByUserId" TEXT,
    "releasedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalHold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DataRetentionPolicy_companyId_entityType_key" ON "DataRetentionPolicy"("companyId", "entityType");

-- CreateIndex
CREATE INDEX "DataRetentionPolicy_companyId_idx" ON "DataRetentionPolicy"("companyId");

-- CreateIndex
CREATE INDEX "DataRetentionPolicy_entityType_idx" ON "DataRetentionPolicy"("entityType");

-- CreateIndex
CREATE INDEX "DataRetentionPolicy_status_idx" ON "DataRetentionPolicy"("status");

-- CreateIndex
CREATE INDEX "DataRetentionPolicy_lastRunAt_idx" ON "DataRetentionPolicy"("lastRunAt");

-- CreateIndex
CREATE INDEX "DataRetentionRun_status_idx" ON "DataRetentionRun"("status");

-- CreateIndex
CREATE INDEX "DataRetentionRun_dryRun_idx" ON "DataRetentionRun"("dryRun");

-- CreateIndex
CREATE INDEX "DataRetentionRun_startedAt_idx" ON "DataRetentionRun"("startedAt");

-- CreateIndex
CREATE INDEX "DataRetentionRunItem_runId_idx" ON "DataRetentionRunItem"("runId");

-- CreateIndex
CREATE INDEX "DataRetentionRunItem_companyId_idx" ON "DataRetentionRunItem"("companyId");

-- CreateIndex
CREATE INDEX "DataRetentionRunItem_policyId_idx" ON "DataRetentionRunItem"("policyId");

-- CreateIndex
CREATE INDEX "DataRetentionRunItem_entityType_idx" ON "DataRetentionRunItem"("entityType");

-- CreateIndex
CREATE INDEX "DataRetentionRunItem_createdAt_idx" ON "DataRetentionRunItem"("createdAt");

-- CreateIndex
CREATE INDEX "LegalHold_companyId_idx" ON "LegalHold"("companyId");

-- CreateIndex
CREATE INDEX "LegalHold_entityType_entityId_idx" ON "LegalHold"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "LegalHold_active_idx" ON "LegalHold"("active");

-- CreateIndex
CREATE INDEX "LegalHold_createdAt_idx" ON "LegalHold"("createdAt");

-- AddForeignKey
ALTER TABLE "DataRetentionRunItem" ADD CONSTRAINT "DataRetentionRunItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DataRetentionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
