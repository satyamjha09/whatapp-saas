-- CreateEnum
CREATE TYPE "BulkMessageBatchStatus" AS ENUM ('QUEUED', 'PARTIAL_FAILED', 'FAILED');

-- CreateEnum
CREATE TYPE "BulkMessageRecipientStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED_DUPLICATE');

-- CreateTable
CREATE TABLE "BulkMessageBatch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "templateId" TEXT,
    "createdByUserId" TEXT,
    "templateName" TEXT,
    "status" "BulkMessageBatchStatus" NOT NULL DEFAULT 'QUEUED',
    "requestedCount" INTEGER NOT NULL DEFAULT 0,
    "queuedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedDuplicateCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkMessageBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkMessageBatchRecipient" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "messageId" TEXT,
    "countryCode" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "name" TEXT,
    "bodyParameters" JSONB,
    "status" "BulkMessageRecipientStatus" NOT NULL DEFAULT 'QUEUED',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkMessageBatchRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BulkMessageBatch_companyId_idx" ON "BulkMessageBatch"("companyId");
CREATE INDEX "BulkMessageBatch_templateId_idx" ON "BulkMessageBatch"("templateId");
CREATE INDEX "BulkMessageBatch_createdByUserId_idx" ON "BulkMessageBatch"("createdByUserId");
CREATE INDEX "BulkMessageBatch_createdAt_idx" ON "BulkMessageBatch"("createdAt");
CREATE UNIQUE INDEX "BulkMessageBatchRecipient_messageId_key" ON "BulkMessageBatchRecipient"("messageId");
CREATE INDEX "BulkMessageBatchRecipient_batchId_idx" ON "BulkMessageBatchRecipient"("batchId");
CREATE INDEX "BulkMessageBatchRecipient_messageId_idx" ON "BulkMessageBatchRecipient"("messageId");
CREATE INDEX "BulkMessageBatchRecipient_phoneNumber_idx" ON "BulkMessageBatchRecipient"("phoneNumber");

-- AddForeignKey
ALTER TABLE "BulkMessageBatch" ADD CONSTRAINT "BulkMessageBatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BulkMessageBatch" ADD CONSTRAINT "BulkMessageBatch_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BulkMessageBatch" ADD CONSTRAINT "BulkMessageBatch_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BulkMessageBatchRecipient" ADD CONSTRAINT "BulkMessageBatchRecipient_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "BulkMessageBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BulkMessageBatchRecipient" ADD CONSTRAINT "BulkMessageBatchRecipient_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
