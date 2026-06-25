-- CreateEnum
CREATE TYPE "BillingRefundStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'PROCESSED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillingRefundType" AS ENUM ('FULL', 'PARTIAL');

-- CreateEnum
CREATE TYPE "BillingRefundSource" AS ENUM ('ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "BillingCreditNoteStatus" AS ENUM ('ISSUED', 'VOID');

-- CreateTable
CREATE TABLE "BillingRefund" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "checkoutId" TEXT,
    "requestedByUserId" TEXT,
    "type" "BillingRefundType" NOT NULL,
    "source" "BillingRefundSource" NOT NULL DEFAULT 'ADMIN',
    "status" "BillingRefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "amountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "reason" TEXT,
    "confirmationText" TEXT,
    "razorpayPaymentId" TEXT,
    "razorpayRefundId" TEXT,
    "razorpayStatus" TEXT,
    "processedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "downgradeApplied" BOOLEAN NOT NULL DEFAULT false,
    "planChangeId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingCreditNote" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "refundId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "creditNoteNumber" TEXT NOT NULL,
    "status" "BillingCreditNoteStatus" NOT NULL DEFAULT 'ISSUED',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "subtotalPaise" INTEGER NOT NULL DEFAULT 0,
    "taxPaise" INTEGER NOT NULL DEFAULT 0,
    "totalPaise" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingCreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillingRefund_companyId_idx" ON "BillingRefund"("companyId");

-- CreateIndex
CREATE INDEX "BillingRefund_invoiceId_idx" ON "BillingRefund"("invoiceId");

-- CreateIndex
CREATE INDEX "BillingRefund_checkoutId_idx" ON "BillingRefund"("checkoutId");

-- CreateIndex
CREATE INDEX "BillingRefund_requestedByUserId_idx" ON "BillingRefund"("requestedByUserId");

-- CreateIndex
CREATE INDEX "BillingRefund_status_idx" ON "BillingRefund"("status");

-- CreateIndex
CREATE INDEX "BillingRefund_type_idx" ON "BillingRefund"("type");

-- CreateIndex
CREATE INDEX "BillingRefund_razorpayPaymentId_idx" ON "BillingRefund"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "BillingRefund_razorpayRefundId_idx" ON "BillingRefund"("razorpayRefundId");

-- CreateIndex
CREATE INDEX "BillingRefund_createdAt_idx" ON "BillingRefund"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCreditNote_refundId_key" ON "BillingCreditNote"("refundId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCreditNote_creditNoteNumber_key" ON "BillingCreditNote"("creditNoteNumber");

-- CreateIndex
CREATE INDEX "BillingCreditNote_companyId_idx" ON "BillingCreditNote"("companyId");

-- CreateIndex
CREATE INDEX "BillingCreditNote_invoiceId_idx" ON "BillingCreditNote"("invoiceId");

-- CreateIndex
CREATE INDEX "BillingCreditNote_status_idx" ON "BillingCreditNote"("status");

-- CreateIndex
CREATE INDEX "BillingCreditNote_issuedAt_idx" ON "BillingCreditNote"("issuedAt");

-- AddForeignKey
ALTER TABLE "BillingRefund" ADD CONSTRAINT "BillingRefund_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingRefund" ADD CONSTRAINT "BillingRefund_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingRefund" ADD CONSTRAINT "BillingRefund_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCreditNote" ADD CONSTRAINT "BillingCreditNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCreditNote" ADD CONSTRAINT "BillingCreditNote_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "BillingRefund"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCreditNote" ADD CONSTRAINT "BillingCreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
