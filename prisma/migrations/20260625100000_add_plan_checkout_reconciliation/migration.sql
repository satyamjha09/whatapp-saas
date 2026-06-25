-- CreateEnum
CREATE TYPE "PlanCheckoutReconciliationStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'EXPIRED', 'SKIPPED');

-- AlterTable
ALTER TABLE "PlanCheckout" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "lastReconciliationAt" TIMESTAMP(3),
ADD COLUMN     "lastReconciliationError" TEXT,
ADD COLUMN     "reconciliationAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "webhookProcessedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PlanCheckoutReconciliationEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "checkoutId" TEXT NOT NULL,
    "status" "PlanCheckoutReconciliationStatus" NOT NULL,
    "source" TEXT NOT NULL,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "message" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanCheckoutReconciliationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanCheckoutReconciliationEvent_companyId_idx" ON "PlanCheckoutReconciliationEvent"("companyId");

-- CreateIndex
CREATE INDEX "PlanCheckoutReconciliationEvent_checkoutId_idx" ON "PlanCheckoutReconciliationEvent"("checkoutId");

-- CreateIndex
CREATE INDEX "PlanCheckoutReconciliationEvent_status_idx" ON "PlanCheckoutReconciliationEvent"("status");

-- CreateIndex
CREATE INDEX "PlanCheckoutReconciliationEvent_source_idx" ON "PlanCheckoutReconciliationEvent"("source");

-- CreateIndex
CREATE INDEX "PlanCheckoutReconciliationEvent_razorpayOrderId_idx" ON "PlanCheckoutReconciliationEvent"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "PlanCheckoutReconciliationEvent_razorpayPaymentId_idx" ON "PlanCheckoutReconciliationEvent"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "PlanCheckoutReconciliationEvent_createdAt_idx" ON "PlanCheckoutReconciliationEvent"("createdAt");

-- CreateIndex
CREATE INDEX "PlanCheckout_expiresAt_idx" ON "PlanCheckout"("expiresAt");

-- CreateIndex
CREATE INDEX "PlanCheckout_webhookProcessedAt_idx" ON "PlanCheckout"("webhookProcessedAt");

-- CreateIndex
CREATE INDEX "PlanCheckout_lastReconciliationAt_idx" ON "PlanCheckout"("lastReconciliationAt");

-- AddForeignKey
ALTER TABLE "PlanCheckoutReconciliationEvent" ADD CONSTRAINT "PlanCheckoutReconciliationEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanCheckoutReconciliationEvent" ADD CONSTRAINT "PlanCheckoutReconciliationEvent_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "PlanCheckout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "FeatureUsageCounter_companyId_featureKey_periodType_periodStart" RENAME TO "FeatureUsageCounter_companyId_featureKey_periodType_periodS_key";
