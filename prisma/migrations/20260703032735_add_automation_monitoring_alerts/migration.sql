-- CreateEnum
CREATE TYPE "AutomationAlertType" AS ENUM ('AUTOMATION_EXECUTION_FAILURE_SPIKE', 'AUTOMATION_NODE_FAILURE_SPIKE', 'AUTOMATION_RUNTIME_QUEUE_STUCK', 'AUTOMATION_RUNTIME_QUEUE_FAILED', 'WEBHOOK_QUEUE_FAILED', 'DEVELOPER_WEBHOOK_QUEUE_FAILED', 'MESSAGE_SEND_FAILURE_SPIKE', 'TALLY_CONNECTION_FAILED', 'GOOGLE_SHEET_AUTH_EXPIRED', 'CASHFREE_PAYMENT_LINK_FAILED', 'CASHFREE_WEBHOOK_DELAYED', 'AI_NODE_FAILED', 'WEBHOOK_NODE_FAILED', 'LOOP_DETECTED', 'DUPLICATE_EXECUTION_BLOCKED', 'INSUFFICIENT_WALLET_SPIKE', 'PLAN_LIMIT_REACHED', 'FLOW_BLOCKED_BY_PLAN', 'WAITING_SESSION_TIMEOUT_SPIKE', 'REDIS_UNHEALTHY', 'WORKER_UNHEALTHY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AutomationAlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AutomationAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'MUTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RbacPermission" ADD VALUE 'AUTOMATION_MONITORING_VIEW';
ALTER TYPE "RbacPermission" ADD VALUE 'AUTOMATION_ALERT_VIEW';
ALTER TYPE "RbacPermission" ADD VALUE 'AUTOMATION_ALERT_MANAGE';
ALTER TYPE "RbacPermission" ADD VALUE 'AUTOMATION_MONITORING_RUN_CHECKS';

-- CreateTable
CREATE TABLE "AutomationAlert" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "AutomationAlertType" NOT NULL,
    "severity" "AutomationAlertSeverity" NOT NULL,
    "status" "AutomationAlertStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "flowId" TEXT,
    "flowVersionId" TEXT,
    "executionId" TEXT,
    "nodeId" TEXT,
    "nodeType" TEXT,
    "contactId" TEXT,
    "queueName" TEXT,
    "integrationType" TEXT,
    "fingerprint" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationAlert_companyId_idx" ON "AutomationAlert"("companyId");

-- CreateIndex
CREATE INDEX "AutomationAlert_companyId_status_idx" ON "AutomationAlert"("companyId", "status");

-- CreateIndex
CREATE INDEX "AutomationAlert_companyId_severity_idx" ON "AutomationAlert"("companyId", "severity");

-- CreateIndex
CREATE INDEX "AutomationAlert_companyId_type_idx" ON "AutomationAlert"("companyId", "type");

-- CreateIndex
CREATE INDEX "AutomationAlert_companyId_flowId_idx" ON "AutomationAlert"("companyId", "flowId");

-- CreateIndex
CREATE INDEX "AutomationAlert_companyId_lastSeenAt_idx" ON "AutomationAlert"("companyId", "lastSeenAt");

-- CreateIndex
CREATE INDEX "AutomationAlert_flowVersionId_idx" ON "AutomationAlert"("flowVersionId");

-- CreateIndex
CREATE INDEX "AutomationAlert_executionId_idx" ON "AutomationAlert"("executionId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationAlert_companyId_fingerprint_status_key" ON "AutomationAlert"("companyId", "fingerprint", "status");

-- AddForeignKey
ALTER TABLE "AutomationAlert" ADD CONSTRAINT "AutomationAlert_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationAlert" ADD CONSTRAINT "AutomationAlert_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "AutomationFlow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationAlert" ADD CONSTRAINT "AutomationAlert_flowVersionId_fkey" FOREIGN KEY ("flowVersionId") REFERENCES "AutomationFlowVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationAlert" ADD CONSTRAINT "AutomationAlert_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "AutomationExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
