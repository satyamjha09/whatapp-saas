-- CreateEnum
CREATE TYPE "InboxNoteType" AS ENUM ('NOTE', 'COMMENT', 'SYSTEM');

-- AlterEnum
ALTER TYPE "CompanyNotificationType" ADD VALUE IF NOT EXISTS 'INBOX';

-- AlterTable
ALTER TABLE "InboxNote"
  ADD COLUMN "parentNoteId" TEXT,
  ADD COLUMN "type" "InboxNoteType" NOT NULL DEFAULT 'NOTE',
  ADD COLUMN "editedAt" TIMESTAMP(3),
  ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "QuickReply"
  ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'COMPANY',
  ADD COLUMN "queueId" TEXT,
  ADD COLUMN "shortcut" TEXT,
  ADD COLUMN "category" TEXT,
  ADD COLUMN "language" TEXT,
  ADD COLUMN "variables" JSONB,
  ADD COLUMN "usageCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastUsedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "InboxNoteMention" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "noteId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InboxNoteMention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxConversationFollower" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "followedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InboxConversationFollower_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InboxNote_parentNoteId_idx" ON "InboxNote"("parentNoteId");

-- CreateIndex
CREATE INDEX "InboxNote_deletedAt_idx" ON "InboxNote"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InboxNoteMention_noteId_userId_key" ON "InboxNoteMention"("noteId", "userId");

-- CreateIndex
CREATE INDEX "InboxNoteMention_companyId_idx" ON "InboxNoteMention"("companyId");

-- CreateIndex
CREATE INDEX "InboxNoteMention_userId_idx" ON "InboxNoteMention"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InboxConversationFollower_contactId_userId_key" ON "InboxConversationFollower"("contactId", "userId");

-- CreateIndex
CREATE INDEX "InboxConversationFollower_companyId_idx" ON "InboxConversationFollower"("companyId");

-- CreateIndex
CREATE INDEX "InboxConversationFollower_userId_idx" ON "InboxConversationFollower"("userId");

-- CreateIndex
CREATE INDEX "QuickReply_queueId_idx" ON "QuickReply"("queueId");

-- CreateIndex
CREATE INDEX "QuickReply_visibility_idx" ON "QuickReply"("visibility");

-- CreateIndex
CREATE INDEX "QuickReply_shortcut_idx" ON "QuickReply"("shortcut");

-- AddForeignKey
ALTER TABLE "InboxNote" ADD CONSTRAINT "InboxNote_parentNoteId_fkey" FOREIGN KEY ("parentNoteId") REFERENCES "InboxNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxNoteMention" ADD CONSTRAINT "InboxNoteMention_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxNoteMention" ADD CONSTRAINT "InboxNoteMention_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "InboxNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxNoteMention" ADD CONSTRAINT "InboxNoteMention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxConversationFollower" ADD CONSTRAINT "InboxConversationFollower_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxConversationFollower" ADD CONSTRAINT "InboxConversationFollower_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxConversationFollower" ADD CONSTRAINT "InboxConversationFollower_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickReply" ADD CONSTRAINT "QuickReply_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "InboxQueue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
