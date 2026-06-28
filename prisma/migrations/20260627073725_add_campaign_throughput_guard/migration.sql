-- CreateEnum
CREATE TYPE "CampaignThroughputPolicyStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "CampaignThroughputMode" AS ENUM ('NORMAL', 'SLOW', 'PAUSED');

-- CreateEnum
CREATE TYPE "CampaignThroughputEventType" AS ENUM ('THROTTLED', 'RATE_LIMIT_HIT', 'AUTO_SLOWDOWN', 'AUTO_RECOVERY', 'AUTO_PAUSE', 'QUALITY_WARNING', 'QUALITY_BLOCK', 'MANUAL_POLICY_UPDATE');

-- CreateEnum
CREATE TYPE "CampaignThroughputEventSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "CampaignThroughputPolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "status" "CampaignThroughputPolicyStatus" NOT NULL DEFAULT 'ACTIVE',
    "mode" "CampaignThroughputMode" NOT NULL DEFAULT 'NORMAL',
    "maxPerMinute" INTEGER NOT NULL DEFAULT 60,
    "maxPerHour" INTEGER NOT NULL DEFAULT 1000,
    "minDelayMs" INTEGER NOT NULL DEFAULT 250,
    "autoSlowdownEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoPauseOnQualityError" BOOLEAN NOT NULL DEFAULT true,
    "slowModeMultiplier" DECIMAL(65,30) NOT NULL DEFAULT 0.25,
    "rateLimitCooldownUntil" TIMESTAMP(3),
    "lastRateLimitAt" TIMESTAMP(3),
    "lastQualityWarningAt" TIMESTAMP(3),
    "updatedByUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignThroughputPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignThroughputEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "policyId" TEXT,
    "type" "CampaignThroughputEventType" NOT NULL,
    "severity" "CampaignThroughputEventSeverity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "retryAfterMs" INTEGER,
    "beforeMode" "CampaignThroughputMode",
    "afterMode" "CampaignThroughputMode",
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignThroughputEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignThroughputSnapshot" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "mode" "CampaignThroughputMode" NOT NULL,
    "maxPerMinute" INTEGER NOT NULL,
    "maxPerHour" INTEGER NOT NULL,
    "sentLastMinute" INTEGER NOT NULL DEFAULT 0,
    "sentLastHour" INTEGER NOT NULL DEFAULT 0,
    "throttledCount" INTEGER NOT NULL DEFAULT 0,
    "rateLimitEvents24h" INTEGER NOT NULL DEFAULT 0,
    "qualityEvents24h" INTEGER NOT NULL DEFAULT 0,
    "isHealthy" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignThroughputSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CampaignThroughputPolicy_campaignId_key" ON "CampaignThroughputPolicy"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignThroughputPolicy_companyId_idx" ON "CampaignThroughputPolicy"("companyId");

-- CreateIndex
CREATE INDEX "CampaignThroughputPolicy_campaignId_idx" ON "CampaignThroughputPolicy"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignThroughputPolicy_status_idx" ON "CampaignThroughputPolicy"("status");

-- CreateIndex
CREATE INDEX "CampaignThroughputPolicy_mode_idx" ON "CampaignThroughputPolicy"("mode");

-- CreateIndex
CREATE INDEX "CampaignThroughputPolicy_updatedByUserId_idx" ON "CampaignThroughputPolicy"("updatedByUserId");

-- CreateIndex
CREATE INDEX "CampaignThroughputPolicy_rateLimitCooldownUntil_idx" ON "CampaignThroughputPolicy"("rateLimitCooldownUntil");

-- CreateIndex
CREATE INDEX "CampaignThroughputPolicy_createdAt_idx" ON "CampaignThroughputPolicy"("createdAt");

-- CreateIndex
CREATE INDEX "CampaignThroughputEvent_companyId_idx" ON "CampaignThroughputEvent"("companyId");

-- CreateIndex
CREATE INDEX "CampaignThroughputEvent_campaignId_idx" ON "CampaignThroughputEvent"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignThroughputEvent_policyId_idx" ON "CampaignThroughputEvent"("policyId");

-- CreateIndex
CREATE INDEX "CampaignThroughputEvent_type_idx" ON "CampaignThroughputEvent"("type");

-- CreateIndex
CREATE INDEX "CampaignThroughputEvent_severity_idx" ON "CampaignThroughputEvent"("severity");

-- CreateIndex
CREATE INDEX "CampaignThroughputEvent_errorCode_idx" ON "CampaignThroughputEvent"("errorCode");

-- CreateIndex
CREATE INDEX "CampaignThroughputEvent_createdAt_idx" ON "CampaignThroughputEvent"("createdAt");

-- CreateIndex
CREATE INDEX "CampaignThroughputSnapshot_companyId_idx" ON "CampaignThroughputSnapshot"("companyId");

-- CreateIndex
CREATE INDEX "CampaignThroughputSnapshot_campaignId_idx" ON "CampaignThroughputSnapshot"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignThroughputSnapshot_mode_idx" ON "CampaignThroughputSnapshot"("mode");

-- CreateIndex
CREATE INDEX "CampaignThroughputSnapshot_isHealthy_idx" ON "CampaignThroughputSnapshot"("isHealthy");

-- CreateIndex
CREATE INDEX "CampaignThroughputSnapshot_createdAt_idx" ON "CampaignThroughputSnapshot"("createdAt");

-- AddForeignKey
ALTER TABLE "CampaignThroughputPolicy" ADD CONSTRAINT "CampaignThroughputPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignThroughputPolicy" ADD CONSTRAINT "CampaignThroughputPolicy_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignThroughputEvent" ADD CONSTRAINT "CampaignThroughputEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignThroughputEvent" ADD CONSTRAINT "CampaignThroughputEvent_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "CampaignThroughputPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignThroughputSnapshot" ADD CONSTRAINT "CampaignThroughputSnapshot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
