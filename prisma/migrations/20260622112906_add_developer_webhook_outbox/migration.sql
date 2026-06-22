-- CreateEnum
CREATE TYPE "DeveloperWebhookOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "DeveloperWebhookOutbox" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "idempotencyKey" TEXT,
    "status" "DeveloperWebhookOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lockedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeveloperWebhookOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeveloperWebhookOutbox_companyId_idx" ON "DeveloperWebhookOutbox"("companyId");

-- CreateIndex
CREATE INDEX "DeveloperWebhookOutbox_eventType_idx" ON "DeveloperWebhookOutbox"("eventType");

-- CreateIndex
CREATE INDEX "DeveloperWebhookOutbox_status_idx" ON "DeveloperWebhookOutbox"("status");

-- CreateIndex
CREATE INDEX "DeveloperWebhookOutbox_createdAt_idx" ON "DeveloperWebhookOutbox"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperWebhookOutbox_companyId_idempotencyKey_key" ON "DeveloperWebhookOutbox"("companyId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "DeveloperWebhookOutbox" ADD CONSTRAINT "DeveloperWebhookOutbox_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
