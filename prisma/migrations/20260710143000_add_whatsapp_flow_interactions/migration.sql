-- CreateEnum
CREATE TYPE "WhatsAppFlowInteractionStatus" AS ENUM ('PENDING', 'QUEUED', 'SENDING', 'SENT', 'FAILED', 'COMPLETED');

-- CreateTable
CREATE TABLE "WhatsAppFlowInteraction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "flowAssetId" TEXT NOT NULL,
    "messageId" TEXT,
    "templateId" TEXT NOT NULL,
    "metaFlowId" TEXT NOT NULL,
    "flowTokenHash" TEXT NOT NULL,
    "flowTokenEncrypted" TEXT NOT NULL,
    "status" "WhatsAppFlowInteractionStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "metaMessageId" TEXT,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppFlowInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppFlowInteraction_messageId_key" ON "WhatsAppFlowInteraction"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppFlowInteraction_flowTokenHash_key" ON "WhatsAppFlowInteraction"("flowTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppFlowInteraction_companyId_idempotencyKey_key" ON "WhatsAppFlowInteraction"("companyId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "WhatsAppFlowInteraction_companyId_idx" ON "WhatsAppFlowInteraction"("companyId");

-- CreateIndex
CREATE INDEX "WhatsAppFlowInteraction_contactId_idx" ON "WhatsAppFlowInteraction"("contactId");

-- CreateIndex
CREATE INDEX "WhatsAppFlowInteraction_flowAssetId_idx" ON "WhatsAppFlowInteraction"("flowAssetId");

-- CreateIndex
CREATE INDEX "WhatsAppFlowInteraction_messageId_idx" ON "WhatsAppFlowInteraction"("messageId");

-- CreateIndex
CREATE INDEX "WhatsAppFlowInteraction_templateId_idx" ON "WhatsAppFlowInteraction"("templateId");

-- CreateIndex
CREATE INDEX "WhatsAppFlowInteraction_metaMessageId_idx" ON "WhatsAppFlowInteraction"("metaMessageId");

-- CreateIndex
CREATE INDEX "WhatsAppFlowInteraction_status_idx" ON "WhatsAppFlowInteraction"("status");

-- CreateIndex
CREATE INDEX "WhatsAppFlowInteraction_createdAt_idx" ON "WhatsAppFlowInteraction"("createdAt");

-- AddForeignKey
ALTER TABLE "WhatsAppFlowInteraction" ADD CONSTRAINT "WhatsAppFlowInteraction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppFlowInteraction" ADD CONSTRAINT "WhatsAppFlowInteraction_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppFlowInteraction" ADD CONSTRAINT "WhatsAppFlowInteraction_flowAssetId_fkey" FOREIGN KEY ("flowAssetId") REFERENCES "WhatsAppFlow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppFlowInteraction" ADD CONSTRAINT "WhatsAppFlowInteraction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppFlowInteraction" ADD CONSTRAINT "WhatsAppFlowInteraction_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
