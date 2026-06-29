-- AlterEnum
ALTER TYPE "ContactSegmentRuleField" ADD VALUE 'LEAD_SCORE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ContactSegmentRuleOperator" ADD VALUE 'GREATER_THAN';
ALTER TYPE "ContactSegmentRuleOperator" ADD VALUE 'LESS_THAN';

-- RenameIndex
ALTER INDEX "CampaignReplyAttribution_companyId_campaignId_contactId_status_" RENAME TO "CampaignReplyAttribution_companyId_campaignId_contactId_sta_idx";
