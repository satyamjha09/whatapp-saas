-- CreateEnum
CREATE TYPE "RazorpayWebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateTable
CREATE TABLE "RazorpayWebhookEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "razorpayEventId" TEXT,
    "eventType" TEXT NOT NULL,
    "status" "RazorpayWebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RazorpayWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RazorpayWebhookEvent_razorpayEventId_key" ON "RazorpayWebhookEvent"("razorpayEventId");

-- CreateIndex
CREATE INDEX "RazorpayWebhookEvent_companyId_idx" ON "RazorpayWebhookEvent"("companyId");

-- CreateIndex
CREATE INDEX "RazorpayWebhookEvent_eventType_idx" ON "RazorpayWebhookEvent"("eventType");

-- CreateIndex
CREATE INDEX "RazorpayWebhookEvent_status_idx" ON "RazorpayWebhookEvent"("status");

-- CreateIndex
CREATE INDEX "RazorpayWebhookEvent_createdAt_idx" ON "RazorpayWebhookEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "RazorpayWebhookEvent" ADD CONSTRAINT "RazorpayWebhookEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
