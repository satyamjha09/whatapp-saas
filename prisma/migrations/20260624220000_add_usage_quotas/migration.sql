-- CreateEnum
CREATE TYPE "FeatureUsagePeriodType" AS ENUM ('MONTHLY', 'LIFETIME');

-- CreateEnum
CREATE TYPE "FeatureUsageEventType" AS ENUM ('INCREMENT', 'DECREMENT', 'SET', 'RESET');

-- CreateEnum
CREATE TYPE "FeatureUsageEventStatus" AS ENUM ('APPLIED', 'SKIPPED_DUPLICATE', 'FAILED');

-- CreateTable
CREATE TABLE "FeatureUsageCounter" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "featureKey" "FeatureEntitlementKey" NOT NULL,
    "periodType" "FeatureUsagePeriodType" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3),
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureUsageCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureUsageEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "counterId" TEXT NOT NULL,
    "featureKey" "FeatureEntitlementKey" NOT NULL,
    "type" "FeatureUsageEventType" NOT NULL,
    "status" "FeatureUsageEventStatus" NOT NULL DEFAULT 'APPLIED',
    "amount" INTEGER NOT NULL,
    "beforeCount" INTEGER NOT NULL,
    "afterCount" INTEGER NOT NULL,
    "idempotencyKey" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeatureUsageCounter_companyId_featureKey_periodType_periodStart_key" ON "FeatureUsageCounter"("companyId", "featureKey", "periodType", "periodStart");

-- CreateIndex
CREATE INDEX "FeatureUsageCounter_companyId_idx" ON "FeatureUsageCounter"("companyId");

-- CreateIndex
CREATE INDEX "FeatureUsageCounter_featureKey_idx" ON "FeatureUsageCounter"("featureKey");

-- CreateIndex
CREATE INDEX "FeatureUsageCounter_periodType_idx" ON "FeatureUsageCounter"("periodType");

-- CreateIndex
CREATE INDEX "FeatureUsageCounter_periodStart_idx" ON "FeatureUsageCounter"("periodStart");

-- CreateIndex
CREATE INDEX "FeatureUsageCounter_periodEnd_idx" ON "FeatureUsageCounter"("periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureUsageEvent_companyId_featureKey_idempotencyKey_key" ON "FeatureUsageEvent"("companyId", "featureKey", "idempotencyKey");

-- CreateIndex
CREATE INDEX "FeatureUsageEvent_companyId_idx" ON "FeatureUsageEvent"("companyId");

-- CreateIndex
CREATE INDEX "FeatureUsageEvent_counterId_idx" ON "FeatureUsageEvent"("counterId");

-- CreateIndex
CREATE INDEX "FeatureUsageEvent_featureKey_idx" ON "FeatureUsageEvent"("featureKey");

-- CreateIndex
CREATE INDEX "FeatureUsageEvent_status_idx" ON "FeatureUsageEvent"("status");

-- CreateIndex
CREATE INDEX "FeatureUsageEvent_createdAt_idx" ON "FeatureUsageEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "FeatureUsageCounter" ADD CONSTRAINT "FeatureUsageCounter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureUsageEvent" ADD CONSTRAINT "FeatureUsageEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureUsageEvent" ADD CONSTRAINT "FeatureUsageEvent_counterId_fkey" FOREIGN KEY ("counterId") REFERENCES "FeatureUsageCounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
