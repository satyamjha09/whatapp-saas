-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BulkMessageBatchStatus" ADD VALUE 'SCHEDULED';
ALTER TYPE "BulkMessageBatchStatus" ADD VALUE 'CANCELED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BulkMessageRecipientStatus" ADD VALUE 'SCHEDULED';
ALTER TYPE "BulkMessageRecipientStatus" ADD VALUE 'CANCELED';

-- AlterTable
ALTER TABLE "BulkMessageBatch" ADD COLUMN     "canceledAt" TIMESTAMP(3),
ADD COLUMN     "scheduledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "BulkMessageBatchRecipient" ADD COLUMN     "queueJobId" TEXT;

-- CreateIndex
CREATE INDEX "BulkMessageBatchRecipient_queueJobId_idx" ON "BulkMessageBatchRecipient"("queueJobId");
