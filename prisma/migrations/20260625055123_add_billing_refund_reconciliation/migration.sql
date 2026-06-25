-- CreateEnum
CREATE TYPE "BillingRefundReconciliationStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "BillingRefund" ADD COLUMN     "lastReconciliationAt" TIMESTAMP(3),
ADD COLUMN     "lastReconciliationError" TEXT,
ADD COLUMN     "reconciliationAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "webhookProcessedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BillingRefundReconciliationEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "refundId" TEXT NOT NULL,
    "status" "BillingRefundReconciliationStatus" NOT NULL,
    "source" TEXT NOT NULL,
    "razorpayRefundId" TEXT,
    "razorpayPaymentId" TEXT,
    "razorpayStatus" TEXT,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "message" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingRefundReconciliationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillingRefundReconciliationEvent_companyId_idx" ON "BillingRefundReconciliationEvent"("companyId");

-- CreateIndex
CREATE INDEX "BillingRefundReconciliationEvent_refundId_idx" ON "BillingRefundReconciliationEvent"("refundId");

-- CreateIndex
CREATE INDEX "BillingRefundReconciliationEvent_status_idx" ON "BillingRefundReconciliationEvent"("status");

-- CreateIndex
CREATE INDEX "BillingRefundReconciliationEvent_source_idx" ON "BillingRefundReconciliationEvent"("source");

-- CreateIndex
CREATE INDEX "BillingRefundReconciliationEvent_razorpayRefundId_idx" ON "BillingRefundReconciliationEvent"("razorpayRefundId");

-- CreateIndex
CREATE INDEX "BillingRefundReconciliationEvent_razorpayPaymentId_idx" ON "BillingRefundReconciliationEvent"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "BillingRefundReconciliationEvent_razorpayStatus_idx" ON "BillingRefundReconciliationEvent"("razorpayStatus");

-- CreateIndex
CREATE INDEX "BillingRefundReconciliationEvent_createdAt_idx" ON "BillingRefundReconciliationEvent"("createdAt");

-- CreateIndex
CREATE INDEX "BillingRefund_lastReconciliationAt_idx" ON "BillingRefund"("lastReconciliationAt");

-- CreateIndex
CREATE INDEX "BillingRefund_webhookProcessedAt_idx" ON "BillingRefund"("webhookProcessedAt");

-- AddForeignKey
ALTER TABLE "BillingRefundReconciliationEvent" ADD CONSTRAINT "BillingRefundReconciliationEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingRefundReconciliationEvent" ADD CONSTRAINT "BillingRefundReconciliationEvent_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "BillingRefund"("id") ON DELETE CASCADE ON UPDATE CASCADE;
