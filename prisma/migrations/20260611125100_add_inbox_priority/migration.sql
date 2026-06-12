-- CreateEnum
CREATE TYPE "InboxPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "inboxPriority" "InboxPriority" NOT NULL DEFAULT 'NORMAL';

-- CreateIndex
CREATE INDEX "Contact_companyId_inboxPriority_idx" ON "Contact"("companyId", "inboxPriority");
