-- AlterEnum
ALTER TYPE "WhatsAppFlowResponseStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "WhatsAppFlowResponseStatus" ADD VALUE IF NOT EXISTS 'PROCESSED';

-- AlterTable
ALTER TABLE "WhatsAppFlowInteraction"
ADD COLUMN IF NOT EXISTS "responseMappingSnapshot" JSONB,
ADD COLUMN IF NOT EXISTS "automationExecutionId" TEXT,
ADD COLUMN IF NOT EXISTS "automationStepId" TEXT,
ADD COLUMN IF NOT EXISTS "automationNodeId" TEXT,
ADD COLUMN IF NOT EXISTS "automationResumeQueuedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WhatsAppFlowResponse"
ADD COLUMN IF NOT EXISTS "processingStartedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "processingResult" JSONB;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WhatsAppFlowInteraction_automationExecutionId_idx" ON "WhatsAppFlowInteraction"("automationExecutionId");
CREATE INDEX IF NOT EXISTS "WhatsAppFlowInteraction_automationStepId_idx" ON "WhatsAppFlowInteraction"("automationStepId");
CREATE INDEX IF NOT EXISTS "WhatsAppFlowInteraction_automationNodeId_idx" ON "WhatsAppFlowInteraction"("automationNodeId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WhatsAppFlowInteraction_automationExecutionId_fkey'
  ) THEN
    ALTER TABLE "WhatsAppFlowInteraction"
    ADD CONSTRAINT "WhatsAppFlowInteraction_automationExecutionId_fkey"
    FOREIGN KEY ("automationExecutionId") REFERENCES "AutomationExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WhatsAppFlowInteraction_automationStepId_fkey'
  ) THEN
    ALTER TABLE "WhatsAppFlowInteraction"
    ADD CONSTRAINT "WhatsAppFlowInteraction_automationStepId_fkey"
    FOREIGN KEY ("automationStepId") REFERENCES "AutomationExecutionStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
