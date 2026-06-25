-- CreateEnum
CREATE TYPE "BillingDocumentPdfType" AS ENUM ('INVOICE', 'CREDIT_NOTE');

-- CreateEnum
CREATE TYPE "BillingDocumentPdfStatus" AS ENUM ('GENERATED', 'FAILED');

-- CreateTable
CREATE TABLE "BillingDocumentPdfRender" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "BillingDocumentPdfType" NOT NULL,
    "status" "BillingDocumentPdfStatus" NOT NULL,
    "invoiceId" TEXT,
    "creditNoteId" TEXT,
    "fileName" TEXT,
    "sizeBytes" INTEGER,
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingDocumentPdfRender_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillingDocumentPdfRender_companyId_idx" ON "BillingDocumentPdfRender"("companyId");

-- CreateIndex
CREATE INDEX "BillingDocumentPdfRender_type_idx" ON "BillingDocumentPdfRender"("type");

-- CreateIndex
CREATE INDEX "BillingDocumentPdfRender_status_idx" ON "BillingDocumentPdfRender"("status");

-- CreateIndex
CREATE INDEX "BillingDocumentPdfRender_invoiceId_idx" ON "BillingDocumentPdfRender"("invoiceId");

-- CreateIndex
CREATE INDEX "BillingDocumentPdfRender_creditNoteId_idx" ON "BillingDocumentPdfRender"("creditNoteId");

-- CreateIndex
CREATE INDEX "BillingDocumentPdfRender_createdAt_idx" ON "BillingDocumentPdfRender"("createdAt");

-- AddForeignKey
ALTER TABLE "BillingDocumentPdfRender" ADD CONSTRAINT "BillingDocumentPdfRender_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocumentPdfRender" ADD CONSTRAINT "BillingDocumentPdfRender_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocumentPdfRender" ADD CONSTRAINT "BillingDocumentPdfRender_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "BillingCreditNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
