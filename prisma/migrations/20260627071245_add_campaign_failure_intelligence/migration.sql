-- CreateEnum
CREATE TYPE "CampaignFailureInsightRunStatus" AS ENUM ('GENERATED', 'FAILED');

-- CreateEnum
CREATE TYPE "CampaignFailureCategory" AS ENUM ('INVALID_PHONE', 'TEMPLATE_ERROR', 'TEMPLATE_VARIABLE_ERROR', 'INSUFFICIENT_WALLET', 'QUOTA_EXCEEDED', 'RATE_LIMIT', 'OUTSIDE_24H_WINDOW', 'CONTACT_OPTED_OUT', 'CONSENT_MISSING', 'PROVIDER_TIMEOUT', 'META_TEMPORARY', 'META_PERMANENT', 'WEBHOOK_ERROR', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CampaignFailureSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "CampaignFailureRetrySafety" AS ENUM ('SAFE_TO_RETRY', 'RETRY_AFTER_FIX', 'DO_NOT_RETRY');

-- CreateEnum
CREATE TYPE "CampaignFailureInsightStatus" AS ENUM ('OPEN', 'FIXED', 'IGNORED', 'RETRIED');

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "errorCode" TEXT,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "queuedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CampaignFailureInsightRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "generatedByUserId" TEXT,
    "status" "CampaignFailureInsightRunStatus" NOT NULL DEFAULT 'GENERATED',
    "totalFailedMessages" INTEGER NOT NULL DEFAULT 0,
    "insightCount" INTEGER NOT NULL DEFAULT 0,
    "retryableCount" INTEGER NOT NULL DEFAULT 0,
    "nonRetryableCount" INTEGER NOT NULL DEFAULT 0,
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignFailureInsightRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignFailureInsight" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "runId" TEXT,
    "status" "CampaignFailureInsightStatus" NOT NULL DEFAULT 'OPEN',
    "category" "CampaignFailureCategory" NOT NULL,
    "severity" "CampaignFailureSeverity" NOT NULL,
    "retrySafety" "CampaignFailureRetrySafety" NOT NULL,
    "errorSignature" TEXT NOT NULL,
    "errorCode" TEXT,
    "sampleErrorMessage" TEXT,
    "failedMessageCount" INTEGER NOT NULL DEFAULT 0,
    "retryableMessageCount" INTEGER NOT NULL DEFAULT 0,
    "sampleMessageIds" JSONB,
    "samplePhoneLast4" JSONB,
    "suggestedFix" TEXT NOT NULL,
    "technicalDetails" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "fixedAt" TIMESTAMP(3),
    "fixedByUserId" TEXT,
    "ignoredAt" TIMESTAMP(3),
    "ignoredByUserId" TEXT,
    "ignoreReason" TEXT,
    "retriedAt" TIMESTAMP(3),
    "retriedByUserId" TEXT,
    "retryBatchId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignFailureInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignFailureInsightRun_companyId_idx" ON "CampaignFailureInsightRun"("companyId");

-- CreateIndex
CREATE INDEX "CampaignFailureInsightRun_campaignId_idx" ON "CampaignFailureInsightRun"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignFailureInsightRun_generatedByUserId_idx" ON "CampaignFailureInsightRun"("generatedByUserId");

-- CreateIndex
CREATE INDEX "CampaignFailureInsightRun_status_idx" ON "CampaignFailureInsightRun"("status");

-- CreateIndex
CREATE INDEX "CampaignFailureInsightRun_createdAt_idx" ON "CampaignFailureInsightRun"("createdAt");

-- CreateIndex
CREATE INDEX "CampaignFailureInsight_companyId_idx" ON "CampaignFailureInsight"("companyId");

-- CreateIndex
CREATE INDEX "CampaignFailureInsight_campaignId_idx" ON "CampaignFailureInsight"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignFailureInsight_runId_idx" ON "CampaignFailureInsight"("runId");

-- CreateIndex
CREATE INDEX "CampaignFailureInsight_status_idx" ON "CampaignFailureInsight"("status");

-- CreateIndex
CREATE INDEX "CampaignFailureInsight_category_idx" ON "CampaignFailureInsight"("category");

-- CreateIndex
CREATE INDEX "CampaignFailureInsight_severity_idx" ON "CampaignFailureInsight"("severity");

-- CreateIndex
CREATE INDEX "CampaignFailureInsight_retrySafety_idx" ON "CampaignFailureInsight"("retrySafety");

-- CreateIndex
CREATE INDEX "CampaignFailureInsight_errorCode_idx" ON "CampaignFailureInsight"("errorCode");

-- CreateIndex
CREATE INDEX "CampaignFailureInsight_fixedByUserId_idx" ON "CampaignFailureInsight"("fixedByUserId");

-- CreateIndex
CREATE INDEX "CampaignFailureInsight_ignoredByUserId_idx" ON "CampaignFailureInsight"("ignoredByUserId");

-- CreateIndex
CREATE INDEX "CampaignFailureInsight_retriedByUserId_idx" ON "CampaignFailureInsight"("retriedByUserId");

-- CreateIndex
CREATE INDEX "CampaignFailureInsight_lastSeenAt_idx" ON "CampaignFailureInsight"("lastSeenAt");

-- CreateIndex
CREATE INDEX "CampaignFailureInsight_createdAt_idx" ON "CampaignFailureInsight"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignFailureInsight_companyId_campaignId_errorSignature_key" ON "CampaignFailureInsight"("companyId", "campaignId", "errorSignature");

-- CreateIndex
CREATE INDEX "Message_errorCode_idx" ON "Message"("errorCode");

-- AddForeignKey
ALTER TABLE "CampaignFailureInsightRun" ADD CONSTRAINT "CampaignFailureInsightRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignFailureInsightRun" ADD CONSTRAINT "CampaignFailureInsightRun_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignFailureInsight" ADD CONSTRAINT "CampaignFailureInsight_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignFailureInsight" ADD CONSTRAINT "CampaignFailureInsight_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CampaignFailureInsightRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignFailureInsight" ADD CONSTRAINT "CampaignFailureInsight_fixedByUserId_fkey" FOREIGN KEY ("fixedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignFailureInsight" ADD CONSTRAINT "CampaignFailureInsight_ignoredByUserId_fkey" FOREIGN KEY ("ignoredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignFailureInsight" ADD CONSTRAINT "CampaignFailureInsight_retriedByUserId_fkey" FOREIGN KEY ("retriedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
