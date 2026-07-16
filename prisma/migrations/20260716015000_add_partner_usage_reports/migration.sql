-- CreateEnum
CREATE TYPE "PartnerUsageLimitAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateTable
CREATE TABLE "PartnerClientUsageDaily" (
    "id" TEXT NOT NULL,
    "partnerCompanyId" TEXT NOT NULL,
    "clientCompanyId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "outboundMessages" INTEGER NOT NULL DEFAULT 0,
    "inboundMessages" INTEGER NOT NULL DEFAULT 0,
    "campaignMessages" INTEGER NOT NULL DEFAULT 0,
    "apiRequests" INTEGER NOT NULL DEFAULT 0,
    "activeContacts" INTEGER NOT NULL DEFAULT 0,
    "teamMembers" INTEGER NOT NULL DEFAULT 0,
    "walletDebitPaise" INTEGER NOT NULL DEFAULT 0,
    "retailChargePaise" INTEGER NOT NULL DEFAULT 0,
    "platformCostPaise" INTEGER NOT NULL DEFAULT 0,
    "grossMarginPaise" INTEGER NOT NULL DEFAULT 0,
    "marginBasisPoints" INTEGER NOT NULL DEFAULT 0,
    "limitAlertCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerClientUsageDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerUsageLimitAlert" (
    "id" TEXT NOT NULL,
    "partnerCompanyId" TEXT NOT NULL,
    "clientCompanyId" TEXT NOT NULL,
    "usageDailyId" TEXT,
    "metric" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "currentValue" INTEGER NOT NULL,
    "status" "PartnerUsageLimitAlertStatus" NOT NULL DEFAULT 'OPEN',
    "message" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerUsageLimitAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerClientUsageDaily_partnerCompanyId_clientCompanyId_date_key" ON "PartnerClientUsageDaily"("partnerCompanyId", "clientCompanyId", "date");
CREATE INDEX "PartnerClientUsageDaily_partnerCompanyId_date_idx" ON "PartnerClientUsageDaily"("partnerCompanyId", "date");
CREATE INDEX "PartnerClientUsageDaily_clientCompanyId_date_idx" ON "PartnerClientUsageDaily"("clientCompanyId", "date");
CREATE INDEX "PartnerClientUsageDaily_subscriptionId_idx" ON "PartnerClientUsageDaily"("subscriptionId");
CREATE INDEX "PartnerClientUsageDaily_date_idx" ON "PartnerClientUsageDaily"("date");
CREATE INDEX "PartnerClientUsageDaily_grossMarginPaise_idx" ON "PartnerClientUsageDaily"("grossMarginPaise");
CREATE UNIQUE INDEX "PartnerUsageLimitAlert_usageDailyId_metric_key" ON "PartnerUsageLimitAlert"("usageDailyId", "metric");
CREATE INDEX "PartnerUsageLimitAlert_partnerCompanyId_status_idx" ON "PartnerUsageLimitAlert"("partnerCompanyId", "status");
CREATE INDEX "PartnerUsageLimitAlert_clientCompanyId_status_idx" ON "PartnerUsageLimitAlert"("clientCompanyId", "status");
CREATE INDEX "PartnerUsageLimitAlert_metric_idx" ON "PartnerUsageLimitAlert"("metric");
CREATE INDEX "PartnerUsageLimitAlert_createdAt_idx" ON "PartnerUsageLimitAlert"("createdAt");

-- AddForeignKey
ALTER TABLE "PartnerClientUsageDaily" ADD CONSTRAINT "PartnerClientUsageDaily_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerClientUsageDaily" ADD CONSTRAINT "PartnerClientUsageDaily_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerClientUsageDaily" ADD CONSTRAINT "PartnerClientUsageDaily_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "PartnerClientSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartnerUsageLimitAlert" ADD CONSTRAINT "PartnerUsageLimitAlert_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerUsageLimitAlert" ADD CONSTRAINT "PartnerUsageLimitAlert_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerUsageLimitAlert" ADD CONSTRAINT "PartnerUsageLimitAlert_usageDailyId_fkey" FOREIGN KEY ("usageDailyId") REFERENCES "PartnerClientUsageDaily"("id") ON DELETE SET NULL ON UPDATE CASCADE;
