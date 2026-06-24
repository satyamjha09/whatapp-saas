-- CreateEnum
CREATE TYPE "BillingInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'VOID', 'FAILED');

-- CreateEnum
CREATE TYPE "BillingInvoiceLineType" AS ENUM ('PLAN', 'USAGE', 'WALLET_TOPUP', 'DISCOUNT', 'TAX', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "BillingInvoice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "status" "BillingInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "subtotalPaise" INTEGER NOT NULL DEFAULT 0,
    "taxPaise" INTEGER NOT NULL DEFAULT 0,
    "totalPaise" INTEGER NOT NULL DEFAULT 0,
    "taxBasisPoints" INTEGER NOT NULL DEFAULT 0,
    "billingName" TEXT,
    "billingEmail" TEXT,
    "billingAddress" TEXT,
    "billingTaxId" TEXT,
    "sellerName" TEXT,
    "sellerEmail" TEXT,
    "sellerAddress" TEXT,
    "sellerTaxId" TEXT,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "planCheckoutId" TEXT,
    "planChangeId" TEXT,
    "issuedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingInvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "type" "BillingInvoiceLineType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitAmountPaise" INTEGER NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingInvoice_invoiceNumber_key" ON "BillingInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "BillingInvoice_companyId_idx" ON "BillingInvoice"("companyId");

-- CreateIndex
CREATE INDEX "BillingInvoice_userId_idx" ON "BillingInvoice"("userId");

-- CreateIndex
CREATE INDEX "BillingInvoice_status_idx" ON "BillingInvoice"("status");

-- CreateIndex
CREATE INDEX "BillingInvoice_issuedAt_idx" ON "BillingInvoice"("issuedAt");

-- CreateIndex
CREATE INDEX "BillingInvoice_paidAt_idx" ON "BillingInvoice"("paidAt");

-- CreateIndex
CREATE INDEX "BillingInvoice_razorpayOrderId_idx" ON "BillingInvoice"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "BillingInvoice_razorpayPaymentId_idx" ON "BillingInvoice"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "BillingInvoice_planCheckoutId_idx" ON "BillingInvoice"("planCheckoutId");

-- CreateIndex
CREATE INDEX "BillingInvoiceLine_invoiceId_idx" ON "BillingInvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "BillingInvoiceLine_type_idx" ON "BillingInvoiceLine"("type");

-- AddForeignKey
ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingInvoiceLine" ADD CONSTRAINT "BillingInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
