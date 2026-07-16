-- CreateEnum
CREATE TYPE "PartnerBillingInvoiceDirection" AS ENUM ('METAWHAT_TO_PARTNER', 'PARTNER_TO_CLIENT');

-- CreateEnum
CREATE TYPE "PartnerBillingPaymentStatus" AS ENUM ('NOT_REQUIRED', 'AWAITING_PAYMENT', 'PAID', 'OVERDUE', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PartnerBillingInvoiceEventType" AS ENUM ('GENERATED', 'ISSUED', 'PAYMENT_LINK_RECORDED', 'PAYMENT_MARKED_PAID', 'PAYMENT_MARKED_FAILED', 'MARKED_OVERDUE', 'VOIDED', 'FAILED', 'BILLING_OWNER_CHANGED');

-- CreateTable
CREATE TABLE "PartnerBillingInvoice" (
    "id" TEXT NOT NULL,
    "partnerCompanyId" TEXT NOT NULL,
    "clientCompanyId" TEXT,
    "subscriptionId" TEXT,
    "billingInvoiceId" TEXT NOT NULL,
    "direction" "PartnerBillingInvoiceDirection" NOT NULL,
    "billingOwnerType" "CompanyBillingOwnerType" NOT NULL,
    "status" "BillingInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentStatus" "PartnerBillingPaymentStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3),
    "overdueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "subtotalPaise" INTEGER NOT NULL DEFAULT 0,
    "taxPaise" INTEGER NOT NULL DEFAULT 0,
    "totalPaise" INTEGER NOT NULL DEFAULT 0,
    "taxBasisPoints" INTEGER NOT NULL DEFAULT 0,
    "paymentProvider" TEXT,
    "paymentReference" TEXT,
    "paymentUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerBillingInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerBillingInvoiceEvent" (
    "id" TEXT NOT NULL,
    "partnerBillingInvoiceId" TEXT NOT NULL,
    "partnerCompanyId" TEXT NOT NULL,
    "clientCompanyId" TEXT,
    "actorUserId" TEXT,
    "type" "PartnerBillingInvoiceEventType" NOT NULL,
    "previousValues" JSONB,
    "newValues" JSONB,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerBillingInvoiceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerBillingInvoice_billingInvoiceId_key" ON "PartnerBillingInvoice"("billingInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerBillingInvoice_direction_subscriptionId_periodStart_periodEnd_key" ON "PartnerBillingInvoice"("direction", "subscriptionId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "PartnerBillingInvoice_partnerCompanyId_idx" ON "PartnerBillingInvoice"("partnerCompanyId");

-- CreateIndex
CREATE INDEX "PartnerBillingInvoice_clientCompanyId_idx" ON "PartnerBillingInvoice"("clientCompanyId");

-- CreateIndex
CREATE INDEX "PartnerBillingInvoice_subscriptionId_idx" ON "PartnerBillingInvoice"("subscriptionId");

-- CreateIndex
CREATE INDEX "PartnerBillingInvoice_direction_idx" ON "PartnerBillingInvoice"("direction");

-- CreateIndex
CREATE INDEX "PartnerBillingInvoice_billingOwnerType_idx" ON "PartnerBillingInvoice"("billingOwnerType");

-- CreateIndex
CREATE INDEX "PartnerBillingInvoice_status_idx" ON "PartnerBillingInvoice"("status");

-- CreateIndex
CREATE INDEX "PartnerBillingInvoice_paymentStatus_idx" ON "PartnerBillingInvoice"("paymentStatus");

-- CreateIndex
CREATE INDEX "PartnerBillingInvoice_dueAt_idx" ON "PartnerBillingInvoice"("dueAt");

-- CreateIndex
CREATE INDEX "PartnerBillingInvoice_overdueAt_idx" ON "PartnerBillingInvoice"("overdueAt");

-- CreateIndex
CREATE INDEX "PartnerBillingInvoice_createdAt_idx" ON "PartnerBillingInvoice"("createdAt");

-- CreateIndex
CREATE INDEX "PartnerBillingInvoiceEvent_partnerBillingInvoiceId_idx" ON "PartnerBillingInvoiceEvent"("partnerBillingInvoiceId");

-- CreateIndex
CREATE INDEX "PartnerBillingInvoiceEvent_partnerCompanyId_idx" ON "PartnerBillingInvoiceEvent"("partnerCompanyId");

-- CreateIndex
CREATE INDEX "PartnerBillingInvoiceEvent_clientCompanyId_idx" ON "PartnerBillingInvoiceEvent"("clientCompanyId");

-- CreateIndex
CREATE INDEX "PartnerBillingInvoiceEvent_actorUserId_idx" ON "PartnerBillingInvoiceEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "PartnerBillingInvoiceEvent_type_idx" ON "PartnerBillingInvoiceEvent"("type");

-- CreateIndex
CREATE INDEX "PartnerBillingInvoiceEvent_createdAt_idx" ON "PartnerBillingInvoiceEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "PartnerBillingInvoice" ADD CONSTRAINT "PartnerBillingInvoice_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerBillingInvoice" ADD CONSTRAINT "PartnerBillingInvoice_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerBillingInvoice" ADD CONSTRAINT "PartnerBillingInvoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "PartnerClientSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerBillingInvoice" ADD CONSTRAINT "PartnerBillingInvoice_billingInvoiceId_fkey" FOREIGN KEY ("billingInvoiceId") REFERENCES "BillingInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerBillingInvoiceEvent" ADD CONSTRAINT "PartnerBillingInvoiceEvent_partnerBillingInvoiceId_fkey" FOREIGN KEY ("partnerBillingInvoiceId") REFERENCES "PartnerBillingInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerBillingInvoiceEvent" ADD CONSTRAINT "PartnerBillingInvoiceEvent_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerBillingInvoiceEvent" ADD CONSTRAINT "PartnerBillingInvoiceEvent_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerBillingInvoiceEvent" ADD CONSTRAINT "PartnerBillingInvoiceEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
