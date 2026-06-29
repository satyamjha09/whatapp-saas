-- AlterEnum
ALTER TYPE "ContactSegmentRuleField" ADD VALUE 'CAMPAIGN_OUTCOME';

-- CreateIndex
CREATE INDEX "CampaignContact_companyId_campaignId_status_idx" ON "CampaignContact"("companyId", "campaignId", "status");

-- CreateIndex
CREATE INDEX "CampaignContact_companyId_campaignId_status_contactId_idx" ON "CampaignContact"("companyId", "campaignId", "status", "contactId");

-- CreateIndex
CREATE INDEX "CampaignReplyAttribution_companyId_campaignId_contactId_status_idx" ON "CampaignReplyAttribution"("companyId", "campaignId", "contactId", "status");
