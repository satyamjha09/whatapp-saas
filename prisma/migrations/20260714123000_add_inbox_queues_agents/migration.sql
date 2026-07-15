-- CreateEnum
CREATE TYPE "InboxQueueStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "InboxAssignmentMode" AS ENUM ('MANUAL', 'ROUND_ROBIN', 'LEAST_OPEN', 'HYBRID');

-- CreateEnum
CREATE TYPE "InboxQueueMemberRole" AS ENUM ('AGENT', 'SUPERVISOR');

-- CreateEnum
CREATE TYPE "InboxAgentAvailabilityStatus" AS ENUM ('AVAILABLE', 'BUSY', 'AWAY', 'OFFLINE');

-- CreateEnum
CREATE TYPE "InboxAssignmentSource" AS ENUM ('MANUAL', 'ROUND_ROBIN', 'LOAD_BASED', 'ROUTING_RULE', 'CHATBOT', 'SYSTEM');

-- AlterEnum
ALTER TYPE "RbacPermission" ADD VALUE IF NOT EXISTS 'INBOX_MANAGE_QUEUES';
ALTER TYPE "RbacPermission" ADD VALUE IF NOT EXISTS 'INBOX_MANAGE_AGENTS';

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN "inboxQueueId" TEXT;
ALTER TABLE "Contact" ADD COLUMN "inboxAssignedAt" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN "inboxAssignmentSource" "InboxAssignmentSource";
ALTER TABLE "Contact" ADD COLUMN "inboxAssignmentVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "InboxQueue" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "status" "InboxQueueStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignmentMode" "InboxAssignmentMode" NOT NULL DEFAULT 'MANUAL',
    "fallbackQueueId" TEXT,
    "maxOpenPerAgent" INTEGER,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxQueueMember" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "queueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "InboxQueueMemberRole" NOT NULL DEFAULT 'AGENT',
    "acceptingNew" BOOLEAN NOT NULL DEFAULT true,
    "maxOpenOverride" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxQueueMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxAgentProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "availabilityStatus" "InboxAgentAvailabilityStatus" NOT NULL DEFAULT 'OFFLINE',
    "acceptingNew" BOOLEAN NOT NULL DEFAULT true,
    "maxOpenConversations" INTEGER NOT NULL DEFAULT 25,
    "preferredLanguage" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "lastAssignedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxAgentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxSkill" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxAgentSkill" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "InboxAgentSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxQueueRequiredSkill" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "queueId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "minimumLevel" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "InboxQueueRequiredSkill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InboxQueue_companyId_slug_key" ON "InboxQueue"("companyId", "slug");

-- CreateIndex
CREATE INDEX "InboxQueue_companyId_status_idx" ON "InboxQueue"("companyId", "status");

-- CreateIndex
CREATE INDEX "InboxQueue_fallbackQueueId_idx" ON "InboxQueue"("fallbackQueueId");

-- CreateIndex
CREATE UNIQUE INDEX "InboxQueueMember_queueId_userId_key" ON "InboxQueueMember"("queueId", "userId");

-- CreateIndex
CREATE INDEX "InboxQueueMember_companyId_idx" ON "InboxQueueMember"("companyId");

-- CreateIndex
CREATE INDEX "InboxQueueMember_userId_idx" ON "InboxQueueMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InboxAgentProfile_companyId_userId_key" ON "InboxAgentProfile"("companyId", "userId");

-- CreateIndex
CREATE INDEX "InboxAgentProfile_companyId_availabilityStatus_idx" ON "InboxAgentProfile"("companyId", "availabilityStatus");

-- CreateIndex
CREATE INDEX "InboxAgentProfile_userId_idx" ON "InboxAgentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InboxSkill_companyId_slug_key" ON "InboxSkill"("companyId", "slug");

-- CreateIndex
CREATE INDEX "InboxSkill_companyId_idx" ON "InboxSkill"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "InboxAgentSkill_userId_skillId_key" ON "InboxAgentSkill"("userId", "skillId");

-- CreateIndex
CREATE INDEX "InboxAgentSkill_companyId_idx" ON "InboxAgentSkill"("companyId");

-- CreateIndex
CREATE INDEX "InboxAgentSkill_skillId_idx" ON "InboxAgentSkill"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "InboxQueueRequiredSkill_queueId_skillId_key" ON "InboxQueueRequiredSkill"("queueId", "skillId");

-- CreateIndex
CREATE INDEX "InboxQueueRequiredSkill_companyId_idx" ON "InboxQueueRequiredSkill"("companyId");

-- CreateIndex
CREATE INDEX "InboxQueueRequiredSkill_skillId_idx" ON "InboxQueueRequiredSkill"("skillId");

-- CreateIndex
CREATE INDEX "Contact_inboxQueueId_idx" ON "Contact"("inboxQueueId");

-- CreateIndex
CREATE INDEX "Contact_companyId_inboxQueueId_inboxStatus_idx" ON "Contact"("companyId", "inboxQueueId", "inboxStatus");

-- CreateIndex
CREATE INDEX "Contact_companyId_assignedToUserId_inboxStatus_idx" ON "Contact"("companyId", "assignedToUserId", "inboxStatus");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_inboxQueueId_fkey" FOREIGN KEY ("inboxQueueId") REFERENCES "InboxQueue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxQueue" ADD CONSTRAINT "InboxQueue_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxQueue" ADD CONSTRAINT "InboxQueue_fallbackQueueId_fkey" FOREIGN KEY ("fallbackQueueId") REFERENCES "InboxQueue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxQueueMember" ADD CONSTRAINT "InboxQueueMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxQueueMember" ADD CONSTRAINT "InboxQueueMember_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "InboxQueue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxQueueMember" ADD CONSTRAINT "InboxQueueMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxAgentProfile" ADD CONSTRAINT "InboxAgentProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxAgentProfile" ADD CONSTRAINT "InboxAgentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxSkill" ADD CONSTRAINT "InboxSkill_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxAgentSkill" ADD CONSTRAINT "InboxAgentSkill_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxAgentSkill" ADD CONSTRAINT "InboxAgentSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxAgentSkill" ADD CONSTRAINT "InboxAgentSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "InboxSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxQueueRequiredSkill" ADD CONSTRAINT "InboxQueueRequiredSkill_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxQueueRequiredSkill" ADD CONSTRAINT "InboxQueueRequiredSkill_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "InboxQueue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxQueueRequiredSkill" ADD CONSTRAINT "InboxQueueRequiredSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "InboxSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
