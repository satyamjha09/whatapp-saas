-- CreateEnum
CREATE TYPE "PlanCheckoutStatus" AS ENUM ('CREATED', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PlanChangeSource" AS ENUM ('CHECKOUT', 'ADMIN_OVERRIDE', 'SYSTEM');

-- CreateTable
CREATE TABLE "PlanCheckout" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "fromPlan" "BillingPlan" NOT NULL,
    "toPlan" "BillingPlan" NOT NULL,
    "status" "PlanCheckoutStatus" NOT NULL DEFAULT 'CREATED',
    "amountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "razorpaySignature" TEXT,
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanCheckout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyPlanChange" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "fromPlan" "BillingPlan" NOT NULL,
    "toPlan" "BillingPlan" NOT NULL,
    "source" "PlanChangeSource" NOT NULL,
    "checkoutId" TEXT,
    "previousMonthlyMessageLimit" INTEGER,
    "newMonthlyMessageLimit" INTEGER,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyPlanChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanCheckout_companyId_idx" ON "PlanCheckout"("companyId");

-- CreateIndex
CREATE INDEX "PlanCheckout_requestedByUserId_idx" ON "PlanCheckout"("requestedByUserId");

-- CreateIndex
CREATE INDEX "PlanCheckout_fromPlan_idx" ON "PlanCheckout"("fromPlan");

-- CreateIndex
CREATE INDEX "PlanCheckout_toPlan_idx" ON "PlanCheckout"("toPlan");

-- CreateIndex
CREATE INDEX "PlanCheckout_status_idx" ON "PlanCheckout"("status");

-- CreateIndex
CREATE INDEX "PlanCheckout_razorpayOrderId_idx" ON "PlanCheckout"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "PlanCheckout_razorpayPaymentId_idx" ON "PlanCheckout"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "PlanCheckout_createdAt_idx" ON "PlanCheckout"("createdAt");

-- CreateIndex
CREATE INDEX "CompanyPlanChange_companyId_idx" ON "CompanyPlanChange"("companyId");

-- CreateIndex
CREATE INDEX "CompanyPlanChange_actorUserId_idx" ON "CompanyPlanChange"("actorUserId");

-- CreateIndex
CREATE INDEX "CompanyPlanChange_fromPlan_idx" ON "CompanyPlanChange"("fromPlan");

-- CreateIndex
CREATE INDEX "CompanyPlanChange_toPlan_idx" ON "CompanyPlanChange"("toPlan");

-- CreateIndex
CREATE INDEX "CompanyPlanChange_source_idx" ON "CompanyPlanChange"("source");

-- CreateIndex
CREATE INDEX "CompanyPlanChange_checkoutId_idx" ON "CompanyPlanChange"("checkoutId");

-- CreateIndex
CREATE INDEX "CompanyPlanChange_createdAt_idx" ON "CompanyPlanChange"("createdAt");

-- AddForeignKey
ALTER TABLE "PlanCheckout" ADD CONSTRAINT "PlanCheckout_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanCheckout" ADD CONSTRAINT "PlanCheckout_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPlanChange" ADD CONSTRAINT "CompanyPlanChange_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPlanChange" ADD CONSTRAINT "CompanyPlanChange_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
