-- AlterTable
ALTER TABLE "AutomationExecution" ADD COLUMN     "conversionType" TEXT,
ADD COLUMN     "conversionValuePaise" INTEGER,
ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "failedNodeId" TEXT,
ADD COLUMN     "failedNodeType" TEXT,
ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "AutomationExecutionStep" ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sourceHandle" TEXT,
ADD COLUMN     "targetNodeId" TEXT;

-- AlterTable
ALTER TABLE "AutomationSession" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "failedAt" TIMESTAMP(3),
ADD COLUMN     "handoffAt" TIMESTAMP(3),
ADD COLUMN     "lastExecutionId" TEXT,
ADD COLUMN     "metadata" JSONB;

-- CreateIndex
CREATE INDEX "AutomationExecution_companyId_flowId_startedAt_idx" ON "AutomationExecution"("companyId", "flowId", "startedAt");

-- CreateIndex
CREATE INDEX "AutomationExecution_companyId_flowId_status_idx" ON "AutomationExecution"("companyId", "flowId", "status");

-- CreateIndex
CREATE INDEX "AutomationExecution_companyId_triggerType_idx" ON "AutomationExecution"("companyId", "triggerType");

-- CreateIndex
CREATE INDEX "AutomationExecution_companyId_failedNodeId_idx" ON "AutomationExecution"("companyId", "failedNodeId");

-- CreateIndex
CREATE INDEX "AutomationExecution_startedAt_idx" ON "AutomationExecution"("startedAt");

-- CreateIndex
CREATE INDEX "AutomationExecutionStep_companyId_executionId_idx" ON "AutomationExecutionStep"("companyId", "executionId");

-- CreateIndex
CREATE INDEX "AutomationExecutionStep_companyId_nodeId_idx" ON "AutomationExecutionStep"("companyId", "nodeId");

-- CreateIndex
CREATE INDEX "AutomationExecutionStep_companyId_nodeType_idx" ON "AutomationExecutionStep"("companyId", "nodeType");

-- CreateIndex
CREATE INDEX "AutomationExecutionStep_companyId_status_idx" ON "AutomationExecutionStep"("companyId", "status");

-- CreateIndex
CREATE INDEX "AutomationExecutionStep_startedAt_idx" ON "AutomationExecutionStep"("startedAt");

-- CreateIndex
CREATE INDEX "AutomationSession_companyId_flowId_status_idx" ON "AutomationSession"("companyId", "flowId", "status");

-- CreateIndex
CREATE INDEX "AutomationSession_companyId_flowVersionId_status_idx" ON "AutomationSession"("companyId", "flowVersionId", "status");

-- CreateIndex
CREATE INDEX "AutomationSession_companyId_currentNodeId_idx" ON "AutomationSession"("companyId", "currentNodeId");

-- CreateIndex
CREATE INDEX "AutomationSession_companyId_waitingForReply_idx" ON "AutomationSession"("companyId", "waitingForReply");

-- CreateIndex
CREATE INDEX "AutomationSession_lastExecutionId_idx" ON "AutomationSession"("lastExecutionId");

-- CreateIndex
CREATE INDEX "AutomationSession_startedAt_idx" ON "AutomationSession"("startedAt");
