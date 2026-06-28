/*
  Warnings:

  - Added the required column `updatedAt` to the `CampaignReplyAttribution` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CampaignReplyIntent" AS ENUM ('POSITIVE', 'NEGATIVE', 'QUESTION', 'OPT_OUT', 'NEUTRAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CampaignReplyAttributionStatus" AS ENUM ('ATTRIBUTED', 'MANUAL', 'IGNORED');

-- CreateEnum
CREATE TYPE "CampaignConversionType" AS ENUM ('REPLY_RECEIVED', 'POSITIVE_REPLY', 'DEMO_BOOKED', 'MEETING_DONE', 'PAYMENT_RECEIVED', 'LEAD_WON', 'LEAD_LOST', 'OPT_OUT');

-- CreateEnum
CREATE TYPE "CampaignFollowUpTaskStatus" AS ENUM ('OPEN', 'COMPLETED', 'IGNORED');

-- CreateEnum
CREATE TYPE "CampaignFollowUpTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ContactActivityType" ADD VALUE 'CAMPAIGN_REPLY_ATTRIBUTED';
ALTER TYPE "ContactActivityType" ADD VALUE 'CAMPAIGN_CONVERSION';
ALTER TYPE "ContactActivityType" ADD VALUE 'CAMPAIGN_FOLLOW_UP_CREATED';

-- AlterEnum
ALTER TYPE "ContactConsentSource" ADD VALUE 'CAMPAIGN_REPLY';

-- AlterTable
ALTER TABLE "CampaignReplyAttribution" ADD COLUMN     "attributedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "autoClassified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoOptOutApplied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inboundMessageId" TEXT,
ADD COLUMN     "intent" "CampaignReplyIntent" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "outboundMessageId" TEXT,
ADD COLUMN     "replyBody" TEXT,
ADD COLUMN     "replyBodyPreview" TEXT,
ADD COLUMN     "replyReceivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "responseTimeMinutes" INTEGER,
ADD COLUMN     "status" "CampaignReplyAttributionStatus" NOT NULL DEFAULT 'ATTRIBUTED',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "CampaignConversionEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT,
    "messageId" TEXT,
    "replyAttributionId" TEXT,
    "type" "CampaignConversionType" NOT NULL,
    "valuePaise" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "note" TEXT,
    "createdByUserId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignConversionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignFollowUpTask" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT,
    "replyAttributionId" TEXT,
    "assignedToUserId" TEXT,
    "status" "CampaignFollowUpTaskStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "CampaignFollowUpTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedByUserId" TEXT,
    "ignoredAt" TIMESTAMP(3),
    "ignoredByUserId" TEXT,
    "ignoreReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignFollowUpTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignConversionEvent_companyId_idx" ON "CampaignConversionEvent"("companyId");

-- CreateIndex
CREATE INDEX "CampaignConversionEvent_campaignId_idx" ON "CampaignConversionEvent"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignConversionEvent_contactId_idx" ON "CampaignConversionEvent"("contactId");

-- CreateIndex
CREATE INDEX "CampaignConversionEvent_messageId_idx" ON "CampaignConversionEvent"("messageId");

-- CreateIndex
CREATE INDEX "CampaignConversionEvent_replyAttributionId_idx" ON "CampaignConversionEvent"("replyAttributionId");

-- CreateIndex
CREATE INDEX "CampaignConversionEvent_type_idx" ON "CampaignConversionEvent"("type");

-- CreateIndex
CREATE INDEX "CampaignConversionEvent_createdByUserId_idx" ON "CampaignConversionEvent"("createdByUserId");

-- CreateIndex
CREATE INDEX "CampaignConversionEvent_occurredAt_idx" ON "CampaignConversionEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "CampaignConversionEvent_createdAt_idx" ON "CampaignConversionEvent"("createdAt");

-- CreateIndex
CREATE INDEX "CampaignFollowUpTask_companyId_idx" ON "CampaignFollowUpTask"("companyId");

-- CreateIndex
CREATE INDEX "CampaignFollowUpTask_campaignId_idx" ON "CampaignFollowUpTask"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignFollowUpTask_contactId_idx" ON "CampaignFollowUpTask"("contactId");

-- CreateIndex
CREATE INDEX "CampaignFollowUpTask_replyAttributionId_idx" ON "CampaignFollowUpTask"("replyAttributionId");

-- CreateIndex
CREATE INDEX "CampaignFollowUpTask_assignedToUserId_idx" ON "CampaignFollowUpTask"("assignedToUserId");

-- CreateIndex
CREATE INDEX "CampaignFollowUpTask_completedByUserId_idx" ON "CampaignFollowUpTask"("completedByUserId");

-- CreateIndex
CREATE INDEX "CampaignFollowUpTask_ignoredByUserId_idx" ON "CampaignFollowUpTask"("ignoredByUserId");

-- CreateIndex
CREATE INDEX "CampaignFollowUpTask_status_idx" ON "CampaignFollowUpTask"("status");

-- CreateIndex
CREATE INDEX "CampaignFollowUpTask_priority_idx" ON "CampaignFollowUpTask"("priority");

-- CreateIndex
CREATE INDEX "CampaignFollowUpTask_dueAt_idx" ON "CampaignFollowUpTask"("dueAt");

-- CreateIndex
CREATE INDEX "CampaignFollowUpTask_createdAt_idx" ON "CampaignFollowUpTask"("createdAt");

-- CreateIndex
CREATE INDEX "CampaignReplyAttribution_inboundMessageId_idx" ON "CampaignReplyAttribution"("inboundMessageId");

-- CreateIndex
CREATE INDEX "CampaignReplyAttribution_outboundMessageId_idx" ON "CampaignReplyAttribution"("outboundMessageId");

-- CreateIndex
CREATE INDEX "CampaignReplyAttribution_status_idx" ON "CampaignReplyAttribution"("status");

-- CreateIndex
CREATE INDEX "CampaignReplyAttribution_intent_idx" ON "CampaignReplyAttribution"("intent");

-- CreateIndex
CREATE INDEX "CampaignReplyAttribution_replyReceivedAt_idx" ON "CampaignReplyAttribution"("replyReceivedAt");

-- CreateIndex
CREATE INDEX "CampaignReplyAttribution_createdAt_idx" ON "CampaignReplyAttribution"("createdAt");

-- AddForeignKey
ALTER TABLE "CampaignReplyAttribution" ADD CONSTRAINT "CampaignReplyAttribution_outboundMessageId_fkey" FOREIGN KEY ("outboundMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignConversionEvent" ADD CONSTRAINT "CampaignConversionEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignConversionEvent" ADD CONSTRAINT "CampaignConversionEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignConversionEvent" ADD CONSTRAINT "CampaignConversionEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignConversionEvent" ADD CONSTRAINT "CampaignConversionEvent_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignConversionEvent" ADD CONSTRAINT "CampaignConversionEvent_replyAttributionId_fkey" FOREIGN KEY ("replyAttributionId") REFERENCES "CampaignReplyAttribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignConversionEvent" ADD CONSTRAINT "CampaignConversionEvent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignFollowUpTask" ADD CONSTRAINT "CampaignFollowUpTask_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignFollowUpTask" ADD CONSTRAINT "CampaignFollowUpTask_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignFollowUpTask" ADD CONSTRAINT "CampaignFollowUpTask_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignFollowUpTask" ADD CONSTRAINT "CampaignFollowUpTask_replyAttributionId_fkey" FOREIGN KEY ("replyAttributionId") REFERENCES "CampaignReplyAttribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignFollowUpTask" ADD CONSTRAINT "CampaignFollowUpTask_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignFollowUpTask" ADD CONSTRAINT "CampaignFollowUpTask_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignFollowUpTask" ADD CONSTRAINT "CampaignFollowUpTask_ignoredByUserId_fkey" FOREIGN KEY ("ignoredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
