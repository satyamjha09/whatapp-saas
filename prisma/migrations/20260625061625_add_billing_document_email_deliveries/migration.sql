-- CreateEnum
CREATE TYPE "BillingDocumentEmailType" AS ENUM ('INVOICE', 'CREDIT_NOTE', 'REFUND_CONFIRMATION');

-- CreateEnum
CREATE TYPE "BillingDocumentEmailStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED');

-- DropIndex
DROP INDEX "BillingProfileUpdateEvent_actorUserId_idx";

-- DropIndex
DROP INDEX "BillingProfileUpdateEvent_companyId_idx";

-- DropIndex
DROP INDEX "BillingProfileUpdateEvent_profileId_idx";

-- DropIndex
DROP INDEX "BillingProfileUpdateEvent_source_idx";

-- CreateTable
CREATE TABLE "BillingDocumentEmailDelivery" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "BillingDocumentEmailType" NOT NULL,
    "status" "BillingDocumentEmailStatus" NOT NULL DEFAULT 'QUEUED',
    "invoiceId" TEXT,
    "creditNoteId" TEXT,
    "refundId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "subject" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingDocumentEmailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingDocumentEmailDelivery_idempotencyKey_key" ON "BillingDocumentEmailDelivery"("idempotencyKey");

-- CreateIndex
CREATE INDEX "BillingDocumentEmailDelivery_companyId_idx" ON "BillingDocumentEmailDelivery"("companyId");

-- CreateIndex
CREATE INDEX "BillingDocumentEmailDelivery_type_idx" ON "BillingDocumentEmailDelivery"("type");

-- CreateIndex
CREATE INDEX "BillingDocumentEmailDelivery_status_idx" ON "BillingDocumentEmailDelivery"("status");

-- CreateIndex
CREATE INDEX "BillingDocumentEmailDelivery_invoiceId_idx" ON "BillingDocumentEmailDelivery"("invoiceId");

-- CreateIndex
CREATE INDEX "BillingDocumentEmailDelivery_creditNoteId_idx" ON "BillingDocumentEmailDelivery"("creditNoteId");

-- CreateIndex
CREATE INDEX "BillingDocumentEmailDelivery_refundId_idx" ON "BillingDocumentEmailDelivery"("refundId");

-- CreateIndex
CREATE INDEX "BillingDocumentEmailDelivery_recipientEmail_idx" ON "BillingDocumentEmailDelivery"("recipientEmail");

-- CreateIndex
CREATE INDEX "BillingDocumentEmailDelivery_sentAt_idx" ON "BillingDocumentEmailDelivery"("sentAt");

-- CreateIndex
CREATE INDEX "BillingDocumentEmailDelivery_createdAt_idx" ON "BillingDocumentEmailDelivery"("createdAt");

-- AddForeignKey
ALTER TABLE "BillingDocumentEmailDelivery" ADD CONSTRAINT "BillingDocumentEmailDelivery_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocumentEmailDelivery" ADD CONSTRAINT "BillingDocumentEmailDelivery_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocumentEmailDelivery" ADD CONSTRAINT "BillingDocumentEmailDelivery_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "BillingCreditNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocumentEmailDelivery" ADD CONSTRAINT "BillingDocumentEmailDelivery_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "BillingRefund"("id") ON DELETE SET NULL ON UPDATE CASCADE;
