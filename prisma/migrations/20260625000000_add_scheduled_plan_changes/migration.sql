-- CreateEnum
CREATE TYPE "ScheduledPlanChangeType" AS ENUM ('CANCEL_AT_PERIOD_END', 'DOWNGRADE_AT_PERIOD_END', 'PLAN_CHANGE_AT_PERIOD_END');

-- CreateEnum
CREATE TYPE "ScheduledPlanChangeStatus" AS ENUM ('SCHEDULED', 'APPLIED', 'CANCELLED', 'FAILED');

-- CreateTable
CREATE TABLE "ScheduledPlanChange" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "type" "ScheduledPlanChangeType" NOT NULL,
    "status" "ScheduledPlanChangeStatus" NOT NULL DEFAULT 'SCHEDULED',
    "fromPlan" "BillingPlan" NOT NULL,
    "toPlan" "BillingPlan",
    "currentPeriodEnd" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledPlanChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledPlanChange_companyId_idx" ON "ScheduledPlanChange"("companyId");

-- CreateIndex
CREATE INDEX "ScheduledPlanChange_requestedByUserId_idx" ON "ScheduledPlanChange"("requestedByUserId");

-- CreateIndex
CREATE INDEX "ScheduledPlanChange_type_idx" ON "ScheduledPlanChange"("type");

-- CreateIndex
CREATE INDEX "ScheduledPlanChange_status_idx" ON "ScheduledPlanChange"("status");

-- CreateIndex
CREATE INDEX "ScheduledPlanChange_fromPlan_idx" ON "ScheduledPlanChange"("fromPlan");

-- CreateIndex
CREATE INDEX "ScheduledPlanChange_toPlan_idx" ON "ScheduledPlanChange"("toPlan");

-- CreateIndex
CREATE INDEX "ScheduledPlanChange_scheduledFor_idx" ON "ScheduledPlanChange"("scheduledFor");

-- CreateIndex
CREATE INDEX "ScheduledPlanChange_createdAt_idx" ON "ScheduledPlanChange"("createdAt");

-- AddForeignKey
ALTER TABLE "ScheduledPlanChange" ADD CONSTRAINT "ScheduledPlanChange_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledPlanChange" ADD CONSTRAINT "ScheduledPlanChange_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
