-- CreateEnum
CREATE TYPE "AutomationFlowStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AutomationSessionStatus" AS ENUM ('ACTIVE', 'WAITING', 'COMPLETED', 'FAILED', 'PAUSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AutomationExecutionStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'WAITING', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AutomationExecutionStepStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'WAITING', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AutomationTriggerType" AS ENUM ('KEYWORD', 'DEFAULT', 'TEMPLATE_REPLY', 'BUTTON_REPLY', 'LIST_REPLY', 'CAMPAIGN_REPLY', 'MANUAL');

-- CreateTable
CREATE TABLE "AutomationFlow" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "AutomationFlowStatus" NOT NULL DEFAULT 'DRAFT',
    "draftGraph" JSONB NOT NULL,
    "publishedVersionId" TEXT,
    "triggerType" "AutomationTriggerType",
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationFlowVersion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "graph" JSONB NOT NULL,
    "validationSnapshot" JSONB,
    "publishNotes" TEXT,
    "publishedByUserId" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationFlowVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationSession" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "flowVersionId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" "AutomationSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentNodeId" TEXT,
    "context" JSONB,
    "waitingForReply" BOOLEAN NOT NULL DEFAULT false,
    "waitingNodeId" TEXT,
    "replyTimeoutAt" TIMESTAMP(3),
    "lastInboundMessageId" TEXT,
    "lastOutboundMessageId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),

    CONSTRAINT "AutomationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationExecution" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "flowVersionId" TEXT NOT NULL,
    "sessionId" TEXT,
    "status" "AutomationExecutionStatus" NOT NULL DEFAULT 'RUNNING',
    "triggerType" "AutomationTriggerType",
    "triggerMessageId" TEXT,
    "triggerPayload" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "AutomationExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationExecutionStep" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "status" "AutomationExecutionStepStatus" NOT NULL DEFAULT 'RUNNING',
    "input" JSONB,
    "output" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AutomationExecutionStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationFlow_companyId_idx" ON "AutomationFlow"("companyId");

-- CreateIndex
CREATE INDEX "AutomationFlow_companyId_status_idx" ON "AutomationFlow"("companyId", "status");

-- CreateIndex
CREATE INDEX "AutomationFlow_companyId_isDefault_idx" ON "AutomationFlow"("companyId", "isDefault");

-- CreateIndex
CREATE INDEX "AutomationFlow_publishedVersionId_idx" ON "AutomationFlow"("publishedVersionId");

-- CreateIndex
CREATE INDEX "AutomationFlowVersion_companyId_idx" ON "AutomationFlowVersion"("companyId");

-- CreateIndex
CREATE INDEX "AutomationFlowVersion_flowId_idx" ON "AutomationFlowVersion"("flowId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationFlowVersion_flowId_versionNumber_key" ON "AutomationFlowVersion"("flowId", "versionNumber");

-- CreateIndex
CREATE INDEX "AutomationSession_companyId_idx" ON "AutomationSession"("companyId");

-- CreateIndex
CREATE INDEX "AutomationSession_companyId_contactId_idx" ON "AutomationSession"("companyId", "contactId");

-- CreateIndex
CREATE INDEX "AutomationSession_companyId_status_idx" ON "AutomationSession"("companyId", "status");

-- CreateIndex
CREATE INDEX "AutomationSession_companyId_flowId_contactId_idx" ON "AutomationSession"("companyId", "flowId", "contactId");

-- CreateIndex
CREATE INDEX "AutomationSession_lastInboundMessageId_idx" ON "AutomationSession"("lastInboundMessageId");

-- CreateIndex
CREATE INDEX "AutomationSession_replyTimeoutAt_idx" ON "AutomationSession"("replyTimeoutAt");

-- CreateIndex
CREATE INDEX "AutomationExecution_companyId_idx" ON "AutomationExecution"("companyId");

-- CreateIndex
CREATE INDEX "AutomationExecution_companyId_flowId_idx" ON "AutomationExecution"("companyId", "flowId");

-- CreateIndex
CREATE INDEX "AutomationExecution_companyId_sessionId_idx" ON "AutomationExecution"("companyId", "sessionId");

-- CreateIndex
CREATE INDEX "AutomationExecution_triggerMessageId_idx" ON "AutomationExecution"("triggerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationExecution_companyId_triggerMessageId_flowId_key" ON "AutomationExecution"("companyId", "triggerMessageId", "flowId");

-- CreateIndex
CREATE INDEX "AutomationExecutionStep_companyId_idx" ON "AutomationExecutionStep"("companyId");

-- CreateIndex
CREATE INDEX "AutomationExecutionStep_executionId_idx" ON "AutomationExecutionStep"("executionId");

-- CreateIndex
CREATE INDEX "AutomationExecutionStep_nodeId_idx" ON "AutomationExecutionStep"("nodeId");

-- AddForeignKey
ALTER TABLE "AutomationFlowVersion" ADD CONSTRAINT "AutomationFlowVersion_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "AutomationFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationSession" ADD CONSTRAINT "AutomationSession_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "AutomationFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationSession" ADD CONSTRAINT "AutomationSession_flowVersionId_fkey" FOREIGN KEY ("flowVersionId") REFERENCES "AutomationFlowVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "AutomationFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_flowVersionId_fkey" FOREIGN KEY ("flowVersionId") REFERENCES "AutomationFlowVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AutomationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecutionStep" ADD CONSTRAINT "AutomationExecutionStep_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "AutomationExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "CampaignReplyAttribution_companyId_campaignId_contactId_status_" RENAME TO "CampaignReplyAttribution_companyId_campaignId_contactId_sta_idx";
