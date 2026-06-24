-- CreateEnum
CREATE TYPE "SubscriptionRenewalEventType" AS ENUM ('REMINDER_SENT', 'PERIOD_RENEWED', 'MARKED_PAST_DUE', 'GRACE_STARTED', 'AUTO_DOWNGRADED', 'MANUALLY_EXTENDED');

-- CreateEnum
CREATE TYPE "SubscriptionRenewalEventStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "SubscriptionRenewalEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "SubscriptionRenewalEventType" NOT NULL,
    "status" "SubscriptionRenewalEventStatus" NOT NULL DEFAULT 'SUCCESS',
    "billingPlan" "BillingPlan" NOT NULL,
    "subscriptionStatus" "SubscriptionStatus" NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "reminderDaysBeforeEnd" INTEGER,
    "previousPlan" "BillingPlan",
    "newPlan" "BillingPlan",
    "previousMonthlyMessageLimit" INTEGER,
    "newMonthlyMessageLimit" INTEGER,
    "idempotencyKey" TEXT,
    "message" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionRenewalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionRenewalEvent_companyId_idempotencyKey_key" ON "SubscriptionRenewalEvent"("companyId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "SubscriptionRenewalEvent_companyId_idx" ON "SubscriptionRenewalEvent"("companyId");

-- CreateIndex
CREATE INDEX "SubscriptionRenewalEvent_type_idx" ON "SubscriptionRenewalEvent"("type");

-- CreateIndex
CREATE INDEX "SubscriptionRenewalEvent_status_idx" ON "SubscriptionRenewalEvent"("status");

-- CreateIndex
CREATE INDEX "SubscriptionRenewalEvent_billingPlan_idx" ON "SubscriptionRenewalEvent"("billingPlan");

-- CreateIndex
CREATE INDEX "SubscriptionRenewalEvent_subscriptionStatus_idx" ON "SubscriptionRenewalEvent"("subscriptionStatus");

-- CreateIndex
CREATE INDEX "SubscriptionRenewalEvent_createdAt_idx" ON "SubscriptionRenewalEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "SubscriptionRenewalEvent" ADD CONSTRAINT "SubscriptionRenewalEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
