-- CreateEnum
CREATE TYPE "DeveloperWebhookDeliveryStatus" AS ENUM ('PENDING', 'SENDING', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "DeveloperWebhookDelivery" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "DeveloperWebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "responseStatus" INTEGER,
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeveloperWebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeveloperWebhookDelivery_companyId_idx" ON "DeveloperWebhookDelivery"("companyId");

-- CreateIndex
CREATE INDEX "DeveloperWebhookDelivery_endpointId_idx" ON "DeveloperWebhookDelivery"("endpointId");

-- CreateIndex
CREATE INDEX "DeveloperWebhookDelivery_status_idx" ON "DeveloperWebhookDelivery"("status");

-- CreateIndex
CREATE INDEX "DeveloperWebhookDelivery_eventType_idx" ON "DeveloperWebhookDelivery"("eventType");

-- AddForeignKey
ALTER TABLE "DeveloperWebhookDelivery" ADD CONSTRAINT "DeveloperWebhookDelivery_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeveloperWebhookDelivery" ADD CONSTRAINT "DeveloperWebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "DeveloperWebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
