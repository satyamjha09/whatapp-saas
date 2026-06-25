-- CreateEnum
CREATE TYPE "BillingMetricSnapshotPeriod" AS ENUM ('DAILY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "BillingMetricSnapshotStatus" AS ENUM ('GENERATED', 'FAILED');

-- CreateTable
CREATE TABLE "BillingMetricSnapshot" (
    "id" TEXT NOT NULL,
    "period" "BillingMetricSnapshotPeriod" NOT NULL,
    "status" "BillingMetricSnapshotStatus" NOT NULL DEFAULT 'GENERATED',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "grossRevenuePaise" INTEGER NOT NULL DEFAULT 0,
    "refundPaise" INTEGER NOT NULL DEFAULT 0,
    "netRevenuePaise" INTEGER NOT NULL DEFAULT 0,
    "paidInvoiceCount" INTEGER NOT NULL DEFAULT 0,
    "refundCount" INTEGER NOT NULL DEFAULT 0,
    "mrrPaise" INTEGER NOT NULL DEFAULT 0,
    "arrPaise" INTEGER NOT NULL DEFAULT 0,
    "activeCompanies" INTEGER NOT NULL DEFAULT 0,
    "paidCompanies" INTEGER NOT NULL DEFAULT 0,
    "freeCompanies" INTEGER NOT NULL DEFAULT 0,
    "pastDueCompanies" INTEGER NOT NULL DEFAULT 0,
    "starterCompanies" INTEGER NOT NULL DEFAULT 0,
    "growthCompanies" INTEGER NOT NULL DEFAULT 0,
    "businessCompanies" INTEGER NOT NULL DEFAULT 0,
    "failedCheckoutCount" INTEGER NOT NULL DEFAULT 0,
    "failedRefundCount" INTEGER NOT NULL DEFAULT 0,
    "planDistribution" JSONB,
    "metadata" JSONB,
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingMetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingMetricSnapshot_period_periodStart_key" ON "BillingMetricSnapshot"("period", "periodStart");

-- CreateIndex
CREATE INDEX "BillingMetricSnapshot_period_idx" ON "BillingMetricSnapshot"("period");

-- CreateIndex
CREATE INDEX "BillingMetricSnapshot_status_idx" ON "BillingMetricSnapshot"("status");

-- CreateIndex
CREATE INDEX "BillingMetricSnapshot_periodStart_idx" ON "BillingMetricSnapshot"("periodStart");

-- CreateIndex
CREATE INDEX "BillingMetricSnapshot_periodEnd_idx" ON "BillingMetricSnapshot"("periodEnd");

-- CreateIndex
CREATE INDEX "BillingMetricSnapshot_createdAt_idx" ON "BillingMetricSnapshot"("createdAt");
