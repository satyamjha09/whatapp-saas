-- CreateEnum
CREATE TYPE "UsageQuotaAlertStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "UsageQuotaAlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "UsageQuotaAlert" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "counterId" TEXT NOT NULL,
    "featureKey" "FeatureEntitlementKey" NOT NULL,
    "thresholdPercent" INTEGER NOT NULL,
    "usedCount" INTEGER NOT NULL,
    "limitValue" INTEGER NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "severity" "UsageQuotaAlertSeverity" NOT NULL,
    "status" "UsageQuotaAlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "message" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageQuotaAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UsageQuotaAlert_companyId_counterId_thresholdPercent_key" ON "UsageQuotaAlert"("companyId", "counterId", "thresholdPercent");

-- CreateIndex
CREATE INDEX "UsageQuotaAlert_companyId_idx" ON "UsageQuotaAlert"("companyId");

-- CreateIndex
CREATE INDEX "UsageQuotaAlert_counterId_idx" ON "UsageQuotaAlert"("counterId");

-- CreateIndex
CREATE INDEX "UsageQuotaAlert_featureKey_idx" ON "UsageQuotaAlert"("featureKey");

-- CreateIndex
CREATE INDEX "UsageQuotaAlert_severity_idx" ON "UsageQuotaAlert"("severity");

-- CreateIndex
CREATE INDEX "UsageQuotaAlert_status_idx" ON "UsageQuotaAlert"("status");

-- CreateIndex
CREATE INDEX "UsageQuotaAlert_createdAt_idx" ON "UsageQuotaAlert"("createdAt");

-- AddForeignKey
ALTER TABLE "UsageQuotaAlert" ADD CONSTRAINT "UsageQuotaAlert_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageQuotaAlert" ADD CONSTRAINT "UsageQuotaAlert_counterId_fkey" FOREIGN KEY ("counterId") REFERENCES "FeatureUsageCounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
