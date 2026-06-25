-- CreateEnum
CREATE TYPE "CompanyPlanAssignmentStatus" AS ENUM ('TRIAL', 'ACTIVE', 'EXPIRED', 'CANCELED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CompanyPlanAssignmentSource" AS ENUM ('SIGNUP', 'PLATFORM_ADMIN', 'SELF_SERVE', 'PARTNER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CompanyPlanAssignmentEventType" AS ENUM ('CREATED', 'ACTIVATED', 'TRIAL_EXTENDED', 'PLAN_CHANGED', 'CANCELED', 'SUSPENDED', 'EXPIRED', 'REACTIVATED');

-- CreateTable
CREATE TABLE "CompanyPlanAssignment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "status" "CompanyPlanAssignmentStatus" NOT NULL DEFAULT 'TRIAL',
    "source" "CompanyPlanAssignmentSource" NOT NULL DEFAULT 'SIGNUP',
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodStartsAt" TIMESTAMP(3),
    "currentPeriodEndsAt" TIMESTAMP(3),
    "assignedByUserId" TEXT,
    "canceledAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "suspensionReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyPlanAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyPlanAssignmentEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "type" "CompanyPlanAssignmentEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyPlanAssignmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyPlanAssignment_companyId_idx" ON "CompanyPlanAssignment"("companyId");

-- CreateIndex
CREATE INDEX "CompanyPlanAssignment_planCode_idx" ON "CompanyPlanAssignment"("planCode");

-- CreateIndex
CREATE INDEX "CompanyPlanAssignment_status_idx" ON "CompanyPlanAssignment"("status");

-- CreateIndex
CREATE INDEX "CompanyPlanAssignment_source_idx" ON "CompanyPlanAssignment"("source");

-- CreateIndex
CREATE INDEX "CompanyPlanAssignment_isCurrent_idx" ON "CompanyPlanAssignment"("isCurrent");

-- CreateIndex
CREATE INDEX "CompanyPlanAssignment_trialEndsAt_idx" ON "CompanyPlanAssignment"("trialEndsAt");

-- CreateIndex
CREATE INDEX "CompanyPlanAssignment_currentPeriodEndsAt_idx" ON "CompanyPlanAssignment"("currentPeriodEndsAt");

-- CreateIndex
CREATE INDEX "CompanyPlanAssignment_assignedByUserId_idx" ON "CompanyPlanAssignment"("assignedByUserId");

-- CreateIndex
CREATE INDEX "CompanyPlanAssignmentEvent_companyId_idx" ON "CompanyPlanAssignmentEvent"("companyId");

-- CreateIndex
CREATE INDEX "CompanyPlanAssignmentEvent_assignmentId_idx" ON "CompanyPlanAssignmentEvent"("assignmentId");

-- CreateIndex
CREATE INDEX "CompanyPlanAssignmentEvent_actorUserId_idx" ON "CompanyPlanAssignmentEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "CompanyPlanAssignmentEvent_type_idx" ON "CompanyPlanAssignmentEvent"("type");

-- CreateIndex
CREATE INDEX "CompanyPlanAssignmentEvent_createdAt_idx" ON "CompanyPlanAssignmentEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "CompanyPlanAssignment" ADD CONSTRAINT "CompanyPlanAssignment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPlanAssignment" ADD CONSTRAINT "CompanyPlanAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPlanAssignmentEvent" ADD CONSTRAINT "CompanyPlanAssignmentEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPlanAssignmentEvent" ADD CONSTRAINT "CompanyPlanAssignmentEvent_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "CompanyPlanAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPlanAssignmentEvent" ADD CONSTRAINT "CompanyPlanAssignmentEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
