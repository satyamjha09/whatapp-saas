-- CreateEnum
CREATE TYPE "ContactActivityType" AS ENUM ('MESSAGE_INBOUND', 'MESSAGE_OUTBOUND', 'NOTE_CREATED', 'NOTE_UPDATED', 'NOTE_DELETED', 'ASSIGNED', 'UNASSIGNED', 'STATUS_CHANGED', 'PRIORITY_CHANGED', 'TAG_ADDED', 'TAG_REMOVED', 'SNOOZED', 'UNSNOOZED', 'BLOCKED', 'UNBLOCKED', 'OPTED_OUT', 'OPTED_IN', 'PROFILE_UPDATED');

-- CreateEnum
CREATE TYPE "InboxSavedViewVisibility" AS ENUM ('PRIVATE', 'COMPANY');

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "externalCustomerId" TEXT,
ADD COLUMN     "lastProfileUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "lastRepliedAt" TIMESTAMP(3),
ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "lifecycleStage" TEXT NOT NULL DEFAULT 'LEAD';

-- CreateTable
CREATE TABLE "ContactActivity" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "type" "ContactActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxSavedView" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "visibility" "InboxSavedViewVisibility" NOT NULL DEFAULT 'PRIVATE',
    "filters" JSONB NOT NULL,
    "sortBy" TEXT NOT NULL DEFAULT 'recent',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxSavedView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactActivity_companyId_idx" ON "ContactActivity"("companyId");

-- CreateIndex
CREATE INDEX "ContactActivity_contactId_idx" ON "ContactActivity"("contactId");

-- CreateIndex
CREATE INDEX "ContactActivity_actorUserId_idx" ON "ContactActivity"("actorUserId");

-- CreateIndex
CREATE INDEX "ContactActivity_type_idx" ON "ContactActivity"("type");

-- CreateIndex
CREATE INDEX "ContactActivity_createdAt_idx" ON "ContactActivity"("createdAt");

-- CreateIndex
CREATE INDEX "InboxSavedView_companyId_idx" ON "InboxSavedView"("companyId");

-- CreateIndex
CREATE INDEX "InboxSavedView_userId_idx" ON "InboxSavedView"("userId");

-- CreateIndex
CREATE INDEX "InboxSavedView_visibility_idx" ON "InboxSavedView"("visibility");

-- CreateIndex
CREATE INDEX "InboxSavedView_isDefault_idx" ON "InboxSavedView"("isDefault");

-- CreateIndex
CREATE INDEX "Contact_companyId_lifecycleStage_idx" ON "Contact"("companyId", "lifecycleStage");

-- CreateIndex
CREATE INDEX "Contact_companyId_externalCustomerId_idx" ON "Contact"("companyId", "externalCustomerId");

-- CreateIndex
CREATE INDEX "Contact_lastSeenAt_idx" ON "Contact"("lastSeenAt");

-- CreateIndex
CREATE INDEX "Contact_lastRepliedAt_idx" ON "Contact"("lastRepliedAt");

-- AddForeignKey
ALTER TABLE "ContactActivity" ADD CONSTRAINT "ContactActivity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactActivity" ADD CONSTRAINT "ContactActivity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactActivity" ADD CONSTRAINT "ContactActivity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxSavedView" ADD CONSTRAINT "InboxSavedView_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxSavedView" ADD CONSTRAINT "InboxSavedView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
