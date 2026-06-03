-- CreateEnum
CREATE TYPE "InboxConversationStatus" AS ENUM ('OPEN', 'CLOSED');

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "inboxClosedAt" TIMESTAMP(3),
ADD COLUMN     "inboxStatus" "InboxConversationStatus" NOT NULL DEFAULT 'OPEN';

-- CreateIndex
CREATE INDEX "Contact_companyId_inboxStatus_idx" ON "Contact"("companyId", "inboxStatus");
