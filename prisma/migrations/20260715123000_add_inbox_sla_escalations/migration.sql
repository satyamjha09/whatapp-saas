-- CreateEnum
CREATE TYPE "InboxSlaEventType" AS ENUM ('TIMER_SET', 'DUE_SOON', 'FIRST_RESPONSE_BREACHED', 'NEXT_RESPONSE_BREACHED', 'RESOLUTION_BREACHED', 'RESPONDED', 'RESOLVED', 'SNOOZED', 'PAUSED', 'RESUMED', 'ESCALATED', 'REOPENED');

-- CreateEnum
CREATE TYPE "InboxEscalationTriggerType" AS ENUM ('DUE_SOON', 'FIRST_RESPONSE_BREACHED', 'NEXT_RESPONSE_BREACHED', 'RESOLUTION_BREACHED', 'BREACH_COUNT');

-- AlterTable
ALTER TABLE "Contact"
ADD COLUMN     "snoozeReason" TEXT,
ADD COLUMN     "snoozedByUserId" TEXT,
ADD COLUMN     "snoozedAt" TIMESTAMP(3),
ADD COLUMN     "inboxFirstResponseDueAt" TIMESTAMP(3),
ADD COLUMN     "inboxNextResponseDueAt" TIMESTAMP(3),
ADD COLUMN     "inboxResolutionDueAt" TIMESTAMP(3),
ADD COLUMN     "inboxFirstRespondedAt" TIMESTAMP(3),
ADD COLUMN     "inboxResolvedAt" TIMESTAMP(3),
ADD COLUMN     "inboxSlaPausedAt" TIMESTAMP(3),
ADD COLUMN     "inboxSlaPausedSeconds" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "InboxBusinessHours" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "queueId" TEXT,
    "name" TEXT NOT NULL DEFAULT 'Default business hours',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxBusinessHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxBusinessHoursWindow" (
    "id" TEXT NOT NULL,
    "businessHoursId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxBusinessHoursWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxHoliday" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxSlaPolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "queueId" TEXT,
    "priority" "InboxPriority" NOT NULL DEFAULT 'NORMAL',
    "firstResponseMinutes" INTEGER NOT NULL DEFAULT 240,
    "nextResponseMinutes" INTEGER NOT NULL DEFAULT 240,
    "resolutionMinutes" INTEGER NOT NULL DEFAULT 1440,
    "dueSoonMinutes" INTEGER NOT NULL DEFAULT 30,
    "pauseWhileSnoozed" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxSlaPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxSlaEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "queueId" TEXT,
    "policyId" TEXT,
    "actorUserId" TEXT,
    "type" "InboxSlaEventType" NOT NULL,
    "dueAt" TIMESTAMP(3),
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxSlaEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxEscalationRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "queueId" TEXT,
    "name" TEXT NOT NULL,
    "priority" "InboxPriority",
    "triggerType" "InboxEscalationTriggerType" NOT NULL,
    "triggerValue" INTEGER NOT NULL DEFAULT 1,
    "actions" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxEscalationRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contact_snoozedByUserId_idx" ON "Contact"("snoozedByUserId");

-- CreateIndex
CREATE INDEX "Contact_companyId_inboxFirstResponseDueAt_idx" ON "Contact"("companyId", "inboxFirstResponseDueAt");

-- CreateIndex
CREATE INDEX "Contact_companyId_inboxNextResponseDueAt_idx" ON "Contact"("companyId", "inboxNextResponseDueAt");

-- CreateIndex
CREATE INDEX "Contact_companyId_inboxResolutionDueAt_idx" ON "Contact"("companyId", "inboxResolutionDueAt");

-- CreateIndex
CREATE INDEX "InboxBusinessHours_companyId_active_idx" ON "InboxBusinessHours"("companyId", "active");

-- CreateIndex
CREATE INDEX "InboxBusinessHours_queueId_idx" ON "InboxBusinessHours"("queueId");

-- CreateIndex
CREATE INDEX "InboxBusinessHoursWindow_businessHoursId_dayOfWeek_idx" ON "InboxBusinessHoursWindow"("businessHoursId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "InboxHoliday_companyId_date_idx" ON "InboxHoliday"("companyId", "date");

-- CreateIndex
CREATE INDEX "InboxHoliday_companyId_active_idx" ON "InboxHoliday"("companyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "InboxSlaPolicy_companyId_queueId_priority_key" ON "InboxSlaPolicy"("companyId", "queueId", "priority");

-- CreateIndex
CREATE INDEX "InboxSlaPolicy_companyId_active_idx" ON "InboxSlaPolicy"("companyId", "active");

-- CreateIndex
CREATE INDEX "InboxSlaPolicy_queueId_idx" ON "InboxSlaPolicy"("queueId");

-- CreateIndex
CREATE INDEX "InboxSlaEvent_companyId_type_occurredAt_idx" ON "InboxSlaEvent"("companyId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX "InboxSlaEvent_contactId_occurredAt_idx" ON "InboxSlaEvent"("contactId", "occurredAt");

-- CreateIndex
CREATE INDEX "InboxSlaEvent_queueId_idx" ON "InboxSlaEvent"("queueId");

-- CreateIndex
CREATE INDEX "InboxSlaEvent_policyId_idx" ON "InboxSlaEvent"("policyId");

-- CreateIndex
CREATE INDEX "InboxEscalationRule_companyId_active_idx" ON "InboxEscalationRule"("companyId", "active");

-- CreateIndex
CREATE INDEX "InboxEscalationRule_queueId_idx" ON "InboxEscalationRule"("queueId");

-- CreateIndex
CREATE INDEX "InboxEscalationRule_companyId_triggerType_idx" ON "InboxEscalationRule"("companyId", "triggerType");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_snoozedByUserId_fkey" FOREIGN KEY ("snoozedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxBusinessHours" ADD CONSTRAINT "InboxBusinessHours_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxBusinessHours" ADD CONSTRAINT "InboxBusinessHours_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "InboxQueue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxBusinessHoursWindow" ADD CONSTRAINT "InboxBusinessHoursWindow_businessHoursId_fkey" FOREIGN KEY ("businessHoursId") REFERENCES "InboxBusinessHours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxHoliday" ADD CONSTRAINT "InboxHoliday_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxSlaPolicy" ADD CONSTRAINT "InboxSlaPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxSlaPolicy" ADD CONSTRAINT "InboxSlaPolicy_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "InboxQueue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxSlaEvent" ADD CONSTRAINT "InboxSlaEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxSlaEvent" ADD CONSTRAINT "InboxSlaEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxSlaEvent" ADD CONSTRAINT "InboxSlaEvent_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "InboxQueue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxSlaEvent" ADD CONSTRAINT "InboxSlaEvent_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "InboxSlaPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxSlaEvent" ADD CONSTRAINT "InboxSlaEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxEscalationRule" ADD CONSTRAINT "InboxEscalationRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxEscalationRule" ADD CONSTRAINT "InboxEscalationRule_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "InboxQueue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
