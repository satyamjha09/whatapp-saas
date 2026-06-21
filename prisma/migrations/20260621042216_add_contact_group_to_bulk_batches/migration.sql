-- AlterEnum
ALTER TYPE "BulkMessageRecipientStatus" ADD VALUE 'SKIPPED_BLOCKED';

-- AlterTable
ALTER TABLE "BulkMessageBatch" ADD COLUMN     "contactGroupId" TEXT,
ADD COLUMN     "contactGroupName" TEXT,
ADD COLUMN     "skippedBlockedCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "BulkMessageBatch_contactGroupId_idx" ON "BulkMessageBatch"("contactGroupId");
