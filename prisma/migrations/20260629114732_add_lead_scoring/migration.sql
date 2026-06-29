-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "leadScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "leadScoreBreakdown" JSONB,
ADD COLUMN     "leadScorePriority" "InboxPriority",
ADD COLUMN     "leadScoreUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LeadScoringConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pointsInboundMessage" INTEGER NOT NULL DEFAULT 5,
    "pointsCampaignRead" INTEGER NOT NULL DEFAULT 3,
    "pointsPositiveReply" INTEGER NOT NULL DEFAULT 15,
    "pointsNegativeReply" INTEGER NOT NULL DEFAULT -10,
    "pointsQuestionReply" INTEGER NOT NULL DEFAULT 8,
    "pointsOptOut" INTEGER NOT NULL DEFAULT -50,
    "pointsDemoBooked" INTEGER NOT NULL DEFAULT 25,
    "pointsPaymentReceived" INTEGER NOT NULL DEFAULT 50,
    "pointsLeadWon" INTEGER NOT NULL DEFAULT 100,
    "pointsLeadLost" INTEGER NOT NULL DEFAULT -20,
    "pointsHighPriority" INTEGER NOT NULL DEFAULT 10,
    "pointsUrgentPriority" INTEGER NOT NULL DEFAULT 20,
    "pointsDecayPerDay" INTEGER NOT NULL DEFAULT -2,
    "decayStartAfterDays" INTEGER NOT NULL DEFAULT 7,
    "thresholdLow" INTEGER NOT NULL DEFAULT 25,
    "thresholdNormal" INTEGER NOT NULL DEFAULT 50,
    "thresholdHigh" INTEGER NOT NULL DEFAULT 75,
    "thresholdUrgent" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadScoringConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeadScoringConfig_companyId_key" ON "LeadScoringConfig"("companyId");

-- CreateIndex
CREATE INDEX "Contact_companyId_leadScore_idx" ON "Contact"("companyId", "leadScore");

-- CreateIndex
CREATE INDEX "Contact_companyId_leadScoreUpdatedAt_idx" ON "Contact"("companyId", "leadScoreUpdatedAt");

-- CreateIndex
CREATE INDEX "Contact_companyId_leadScorePriority_idx" ON "Contact"("companyId", "leadScorePriority");

-- CreateIndex
CREATE INDEX "Contact_companyId_inboxStatus_leadScore_idx" ON "Contact"("companyId", "inboxStatus", "leadScore");

-- AddForeignKey
ALTER TABLE "LeadScoringConfig" ADD CONSTRAINT "LeadScoringConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
