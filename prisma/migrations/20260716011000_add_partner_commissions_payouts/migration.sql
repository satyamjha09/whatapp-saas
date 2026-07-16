-- CreateEnum
CREATE TYPE "PartnerCommissionAccrualType" AS ENUM ('COMMISSION', 'REVERSAL', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PartnerCommissionAccrualStatus" AS ENUM ('PENDING_HOLD', 'AVAILABLE', 'INCLUDED_IN_PAYOUT', 'PAID', 'REVERSED', 'VOIDED');

-- CreateEnum
CREATE TYPE "PartnerPayoutStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PartnerPayoutEventType" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'PROCESSING_STARTED', 'MARKED_PAID', 'MARKED_FAILED', 'CANCELED', 'RECONCILED');

-- CreateTable
CREATE TABLE "PartnerCommissionRule" (
    "id" TEXT NOT NULL,
    "partnerCompanyId" TEXT NOT NULL,
    "planCode" "BillingPlan",
    "percentageBps" INTEGER,
    "fixedAmountPaise" INTEGER,
    "holdDays" INTEGER NOT NULL DEFAULT 14,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerCommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerCommissionAccrual" (
    "id" TEXT NOT NULL,
    "partnerCompanyId" TEXT NOT NULL,
    "clientCompanyId" TEXT,
    "subscriptionId" TEXT,
    "partnerBillingInvoiceId" TEXT,
    "payoutId" TEXT,
    "type" "PartnerCommissionAccrualType" NOT NULL DEFAULT 'COMMISSION',
    "status" "PartnerCommissionAccrualStatus" NOT NULL DEFAULT 'PENDING_HOLD',
    "grossAmountPaise" INTEGER NOT NULL,
    "commissionAmountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "holdDays" INTEGER NOT NULL DEFAULT 14,
    "availableAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "reversalOfAccrualId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'partner_commission',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerCommissionAccrual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerPayout" (
    "id" TEXT NOT NULL,
    "partnerCompanyId" TEXT NOT NULL,
    "status" "PartnerPayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "amountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "processedByUserId" TEXT,
    "bankReference" TEXT,
    "failureReason" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerPayoutEvent" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "partnerCompanyId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "type" "PartnerPayoutEventType" NOT NULL,
    "previousValues" JSONB,
    "newValues" JSONB,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerPayoutEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerCommissionRule_partnerCompanyId_active_idx" ON "PartnerCommissionRule"("partnerCompanyId", "active");

-- CreateIndex
CREATE INDEX "PartnerCommissionRule_planCode_idx" ON "PartnerCommissionRule"("planCode");

-- CreateIndex
CREATE INDEX "PartnerCommissionRule_startsAt_idx" ON "PartnerCommissionRule"("startsAt");

-- CreateIndex
CREATE INDEX "PartnerCommissionRule_endsAt_idx" ON "PartnerCommissionRule"("endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerCommissionAccrual_idempotencyKey_key" ON "PartnerCommissionAccrual"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PartnerCommissionAccrual_partnerCompanyId_status_idx" ON "PartnerCommissionAccrual"("partnerCompanyId", "status");

-- CreateIndex
CREATE INDEX "PartnerCommissionAccrual_clientCompanyId_idx" ON "PartnerCommissionAccrual"("clientCompanyId");

-- CreateIndex
CREATE INDEX "PartnerCommissionAccrual_subscriptionId_idx" ON "PartnerCommissionAccrual"("subscriptionId");

-- CreateIndex
CREATE INDEX "PartnerCommissionAccrual_partnerBillingInvoiceId_idx" ON "PartnerCommissionAccrual"("partnerBillingInvoiceId");

-- CreateIndex
CREATE INDEX "PartnerCommissionAccrual_payoutId_idx" ON "PartnerCommissionAccrual"("payoutId");

-- CreateIndex
CREATE INDEX "PartnerCommissionAccrual_type_idx" ON "PartnerCommissionAccrual"("type");

-- CreateIndex
CREATE INDEX "PartnerCommissionAccrual_availableAt_idx" ON "PartnerCommissionAccrual"("availableAt");

-- CreateIndex
CREATE INDEX "PartnerCommissionAccrual_createdAt_idx" ON "PartnerCommissionAccrual"("createdAt");

-- CreateIndex
CREATE INDEX "PartnerPayout_partnerCompanyId_status_idx" ON "PartnerPayout"("partnerCompanyId", "status");

-- CreateIndex
CREATE INDEX "PartnerPayout_approvedByUserId_idx" ON "PartnerPayout"("approvedByUserId");

-- CreateIndex
CREATE INDEX "PartnerPayout_processedByUserId_idx" ON "PartnerPayout"("processedByUserId");

-- CreateIndex
CREATE INDEX "PartnerPayout_requestedAt_idx" ON "PartnerPayout"("requestedAt");

-- CreateIndex
CREATE INDEX "PartnerPayout_paidAt_idx" ON "PartnerPayout"("paidAt");

-- CreateIndex
CREATE INDEX "PartnerPayoutEvent_payoutId_idx" ON "PartnerPayoutEvent"("payoutId");

-- CreateIndex
CREATE INDEX "PartnerPayoutEvent_partnerCompanyId_idx" ON "PartnerPayoutEvent"("partnerCompanyId");

-- CreateIndex
CREATE INDEX "PartnerPayoutEvent_actorUserId_idx" ON "PartnerPayoutEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "PartnerPayoutEvent_type_idx" ON "PartnerPayoutEvent"("type");

-- CreateIndex
CREATE INDEX "PartnerPayoutEvent_createdAt_idx" ON "PartnerPayoutEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "PartnerCommissionRule" ADD CONSTRAINT "PartnerCommissionRule_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCommissionAccrual" ADD CONSTRAINT "PartnerCommissionAccrual_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCommissionAccrual" ADD CONSTRAINT "PartnerCommissionAccrual_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCommissionAccrual" ADD CONSTRAINT "PartnerCommissionAccrual_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "PartnerClientSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCommissionAccrual" ADD CONSTRAINT "PartnerCommissionAccrual_partnerBillingInvoiceId_fkey" FOREIGN KEY ("partnerBillingInvoiceId") REFERENCES "PartnerBillingInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCommissionAccrual" ADD CONSTRAINT "PartnerCommissionAccrual_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "PartnerPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCommissionAccrual" ADD CONSTRAINT "PartnerCommissionAccrual_reversalOfAccrualId_fkey" FOREIGN KEY ("reversalOfAccrualId") REFERENCES "PartnerCommissionAccrual"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPayout" ADD CONSTRAINT "PartnerPayout_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPayout" ADD CONSTRAINT "PartnerPayout_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPayout" ADD CONSTRAINT "PartnerPayout_processedByUserId_fkey" FOREIGN KEY ("processedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPayoutEvent" ADD CONSTRAINT "PartnerPayoutEvent_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "PartnerPayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPayoutEvent" ADD CONSTRAINT "PartnerPayoutEvent_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPayoutEvent" ADD CONSTRAINT "PartnerPayoutEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
