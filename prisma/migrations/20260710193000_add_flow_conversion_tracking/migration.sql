-- Explicit WhatsApp Flow business conversion snapshot/result fields.
-- Existing rows stay nullable; analytics derives from persisted timestamps only.
ALTER TABLE "WhatsAppFlowInteraction"
  ADD COLUMN "conversionGoalNodeId" TEXT,
  ADD COLUMN "conversionSource" TEXT,
  ADD COLUMN "conversionKey" TEXT,
  ADD COLUMN "convertedAt" TIMESTAMP(3);

CREATE INDEX "WhatsAppFlowInteraction_conversionGoalNodeId_idx"
  ON "WhatsAppFlowInteraction"("conversionGoalNodeId");

CREATE INDEX "WhatsAppFlowInteraction_convertedAt_idx"
  ON "WhatsAppFlowInteraction"("convertedAt");

CREATE INDEX "WhatsAppFlowInteraction_companyId_sentAt_idx"
  ON "WhatsAppFlowInteraction"("companyId", "sentAt");

CREATE INDEX "WhatsAppFlowInteraction_companyId_completedAt_idx"
  ON "WhatsAppFlowInteraction"("companyId", "completedAt");

CREATE INDEX "WhatsAppFlowInteraction_companyId_convertedAt_idx"
  ON "WhatsAppFlowInteraction"("companyId", "convertedAt");
