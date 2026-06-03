-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CampaignContactStatus" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "campaignContactId" TEXT,
ADD COLUMN     "campaignId" TEXT;

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "variables" TEXT[],
    "totalContacts" INTEGER NOT NULL DEFAULT 0,
    "queuedCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "readCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignContact" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" "CampaignContactStatus" NOT NULL DEFAULT 'PENDING',
    "variables" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Campaign_companyId_idx" ON "Campaign"("companyId");

-- CreateIndex
CREATE INDEX "Campaign_templateId_idx" ON "Campaign"("templateId");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE INDEX "CampaignContact_companyId_idx" ON "CampaignContact"("companyId");

-- CreateIndex
CREATE INDEX "CampaignContact_campaignId_idx" ON "CampaignContact"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignContact_contactId_idx" ON "CampaignContact"("contactId");

-- CreateIndex
CREATE INDEX "CampaignContact_status_idx" ON "CampaignContact"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignContact_campaignId_contactId_key" ON "CampaignContact"("campaignId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_campaignContactId_key" ON "Message"("campaignContactId");

-- CreateIndex
CREATE INDEX "Message_campaignId_idx" ON "Message"("campaignId");

-- CreateIndex
CREATE INDEX "Message_campaignContactId_idx" ON "Message"("campaignContactId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_campaignContactId_fkey" FOREIGN KEY ("campaignContactId") REFERENCES "CampaignContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignContact" ADD CONSTRAINT "CampaignContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignContact" ADD CONSTRAINT "CampaignContact_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignContact" ADD CONSTRAINT "CampaignContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
