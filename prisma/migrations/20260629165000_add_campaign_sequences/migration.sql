-- CreateEnum
CREATE TYPE "CampaignSequenceCondition" AS ENUM ('NO_REPLY', 'OPENED', 'CLICKED');

-- CreateEnum
CREATE TYPE "CampaignSequenceExecutionStatus" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "CampaignSequenceStep" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "condition" "CampaignSequenceCondition" NOT NULL DEFAULT 'NO_REPLY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "variables" TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignSequenceStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignSequenceExecution" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "previousMessageId" TEXT,
    "messageId" TEXT,
    "status" "CampaignSequenceExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignSequenceExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CampaignSequenceStep_campaignId_order_key" ON "CampaignSequenceStep"("campaignId", "order");

-- CreateIndex
CREATE INDEX "CampaignSequenceStep_companyId_idx" ON "CampaignSequenceStep"("companyId");

-- CreateIndex
CREATE INDEX "CampaignSequenceStep_campaignId_idx" ON "CampaignSequenceStep"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignSequenceStep_templateId_idx" ON "CampaignSequenceStep"("templateId");

-- CreateIndex
CREATE INDEX "CampaignSequenceStep_condition_idx" ON "CampaignSequenceStep"("condition");

-- CreateIndex
CREATE INDEX "CampaignSequenceStep_isActive_idx" ON "CampaignSequenceStep"("isActive");

-- CreateIndex
CREATE INDEX "CampaignSequenceStep_order_idx" ON "CampaignSequenceStep"("order");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignSequenceExecution_stepId_contactId_key" ON "CampaignSequenceExecution"("stepId", "contactId");

-- CreateIndex
CREATE INDEX "CampaignSequenceExecution_companyId_idx" ON "CampaignSequenceExecution"("companyId");

-- CreateIndex
CREATE INDEX "CampaignSequenceExecution_campaignId_idx" ON "CampaignSequenceExecution"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignSequenceExecution_stepId_idx" ON "CampaignSequenceExecution"("stepId");

-- CreateIndex
CREATE INDEX "CampaignSequenceExecution_contactId_idx" ON "CampaignSequenceExecution"("contactId");

-- CreateIndex
CREATE INDEX "CampaignSequenceExecution_previousMessageId_idx" ON "CampaignSequenceExecution"("previousMessageId");

-- CreateIndex
CREATE INDEX "CampaignSequenceExecution_messageId_idx" ON "CampaignSequenceExecution"("messageId");

-- CreateIndex
CREATE INDEX "CampaignSequenceExecution_status_idx" ON "CampaignSequenceExecution"("status");

-- CreateIndex
CREATE INDEX "CampaignSequenceExecution_dueAt_idx" ON "CampaignSequenceExecution"("dueAt");

-- CreateIndex
CREATE INDEX "CampaignSequenceExecution_createdAt_idx" ON "CampaignSequenceExecution"("createdAt");

-- AddForeignKey
ALTER TABLE "CampaignSequenceStep" ADD CONSTRAINT "CampaignSequenceStep_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSequenceStep" ADD CONSTRAINT "CampaignSequenceStep_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSequenceStep" ADD CONSTRAINT "CampaignSequenceStep_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSequenceExecution" ADD CONSTRAINT "CampaignSequenceExecution_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSequenceExecution" ADD CONSTRAINT "CampaignSequenceExecution_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSequenceExecution" ADD CONSTRAINT "CampaignSequenceExecution_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "CampaignSequenceStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSequenceExecution" ADD CONSTRAINT "CampaignSequenceExecution_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSequenceExecution" ADD CONSTRAINT "CampaignSequenceExecution_previousMessageId_fkey" FOREIGN KEY ("previousMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSequenceExecution" ADD CONSTRAINT "CampaignSequenceExecution_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
