-- AlterTable
ALTER TABLE "AutomationFlow" ADD COLUMN     "lastPublishedByUserId" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AutomationFlowVersion" ADD COLUMN     "isRollback" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rollbackFromVersionId" TEXT;

-- CreateIndex
CREATE INDEX "AutomationExecution_companyId_flowVersionId_idx" ON "AutomationExecution"("companyId", "flowVersionId");

-- CreateIndex
CREATE INDEX "AutomationFlowVersion_companyId_flowId_idx" ON "AutomationFlowVersion"("companyId", "flowId");

-- CreateIndex
CREATE INDEX "AutomationFlowVersion_companyId_publishedAt_idx" ON "AutomationFlowVersion"("companyId", "publishedAt");

-- CreateIndex
CREATE INDEX "AutomationSession_companyId_flowVersionId_idx" ON "AutomationSession"("companyId", "flowVersionId");
