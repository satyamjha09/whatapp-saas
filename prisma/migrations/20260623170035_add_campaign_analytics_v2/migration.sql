-- CreateEnum
CREATE TYPE "CampaignAnalyticsSnapshotStatus" AS ENUM ('FRESH', 'STALE', 'FAILED');

-- CreateEnum
CREATE TYPE "CampaignReplyAttributionSource" AS ENUM ('AUTO', 'MANUAL');

-- CreateTable
CREATE TABLE "CampaignAnalyticsSnapshot" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "status" "CampaignAnalyticsSnapshotStatus" NOT NULL DEFAULT 'FRESH',
    "totalContacts" INTEGER NOT NULL DEFAULT 0,
    "queuedCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "readCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "repliedCount" INTEGER NOT NULL DEFAULT 0,
    "optedOutCount" INTEGER NOT NULL DEFAULT 0,
    "chargedCount" INTEGER NOT NULL DEFAULT 0,
    "totalCostPaise" INTEGER NOT NULL DEFAULT 0,
    "sentRateBps" INTEGER NOT NULL DEFAULT 0,
    "deliveredRateBps" INTEGER NOT NULL DEFAULT 0,
    "readRateBps" INTEGER NOT NULL DEFAULT 0,
    "replyRateBps" INTEGER NOT NULL DEFAULT 0,
    "optOutRateBps" INTEGER NOT NULL DEFAULT 0,
    "failureRateBps" INTEGER NOT NULL DEFAULT 0,
    "firstMessageAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "lastReplyAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignAnalyticsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignReplyAttribution" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "source" "CampaignReplyAttributionSource" NOT NULL DEFAULT 'AUTO',
    "repliedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignReplyAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignAnalyticsSnapshot_companyId_idx" ON "CampaignAnalyticsSnapshot"("companyId");

-- CreateIndex
CREATE INDEX "CampaignAnalyticsSnapshot_status_idx" ON "CampaignAnalyticsSnapshot"("status");

-- CreateIndex
CREATE INDEX "CampaignAnalyticsSnapshot_lastSyncedAt_idx" ON "CampaignAnalyticsSnapshot"("lastSyncedAt");

-- CreateIndex
CREATE INDEX "CampaignAnalyticsSnapshot_totalCostPaise_idx" ON "CampaignAnalyticsSnapshot"("totalCostPaise");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignAnalyticsSnapshot_campaignId_key" ON "CampaignAnalyticsSnapshot"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignReplyAttribution_companyId_idx" ON "CampaignReplyAttribution"("companyId");

-- CreateIndex
CREATE INDEX "CampaignReplyAttribution_campaignId_idx" ON "CampaignReplyAttribution"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignReplyAttribution_contactId_idx" ON "CampaignReplyAttribution"("contactId");

-- CreateIndex
CREATE INDEX "CampaignReplyAttribution_messageId_idx" ON "CampaignReplyAttribution"("messageId");

-- CreateIndex
CREATE INDEX "CampaignReplyAttribution_repliedAt_idx" ON "CampaignReplyAttribution"("repliedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignReplyAttribution_campaignId_messageId_key" ON "CampaignReplyAttribution"("campaignId", "messageId");

-- AddForeignKey
ALTER TABLE "CampaignAnalyticsSnapshot" ADD CONSTRAINT "CampaignAnalyticsSnapshot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignAnalyticsSnapshot" ADD CONSTRAINT "CampaignAnalyticsSnapshot_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignReplyAttribution" ADD CONSTRAINT "CampaignReplyAttribution_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignReplyAttribution" ADD CONSTRAINT "CampaignReplyAttribution_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignReplyAttribution" ADD CONSTRAINT "CampaignReplyAttribution_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignReplyAttribution" ADD CONSTRAINT "CampaignReplyAttribution_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
