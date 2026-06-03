-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'whatsapp',
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "eventType" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebhookEvent_companyId_idx" ON "WebhookEvent"("companyId");

-- CreateIndex
CREATE INDEX "WebhookEvent_status_idx" ON "WebhookEvent"("status");

-- CreateIndex
CREATE INDEX "WebhookEvent_eventType_idx" ON "WebhookEvent"("eventType");

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
