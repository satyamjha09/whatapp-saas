-- CreateEnum
CREATE TYPE "UnmappedWebhookEventStatus" AS ENUM ('UNRESOLVED', 'RESOLVED', 'IGNORED');

-- CreateTable
CREATE TABLE "UnmappedWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'META',
    "phoneNumberId" TEXT,
    "eventType" TEXT,
    "payload" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "UnmappedWebhookEventStatus" NOT NULL DEFAULT 'UNRESOLVED',
    "dedupeKey" TEXT,
    "resolvedCompanyId" TEXT,
    "resolvedWebhookEventId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnmappedWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnmappedWebhookEvent_dedupeKey_key" ON "UnmappedWebhookEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "UnmappedWebhookEvent_phoneNumberId_idx" ON "UnmappedWebhookEvent"("phoneNumberId");

-- CreateIndex
CREATE INDEX "UnmappedWebhookEvent_status_idx" ON "UnmappedWebhookEvent"("status");

-- CreateIndex
CREATE INDEX "UnmappedWebhookEvent_createdAt_idx" ON "UnmappedWebhookEvent"("createdAt");

-- CreateIndex
CREATE INDEX "UnmappedWebhookEvent_resolvedCompanyId_idx" ON "UnmappedWebhookEvent"("resolvedCompanyId");

-- AddForeignKey
ALTER TABLE "UnmappedWebhookEvent" ADD CONSTRAINT "UnmappedWebhookEvent_resolvedCompanyId_fkey" FOREIGN KEY ("resolvedCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnmappedWebhookEvent" ADD CONSTRAINT "UnmappedWebhookEvent_resolvedWebhookEventId_fkey" FOREIGN KEY ("resolvedWebhookEventId") REFERENCES "WebhookEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
