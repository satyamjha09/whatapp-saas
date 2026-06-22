-- AlterTable
ALTER TABLE "DeveloperWebhookDelivery" ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "outboxEventId" TEXT,
ADD COLUMN     "responseBody" TEXT;

-- CreateIndex
CREATE INDEX "DeveloperWebhookDelivery_outboxEventId_idx" ON "DeveloperWebhookDelivery"("outboxEventId");

-- AddForeignKey
ALTER TABLE "DeveloperWebhookDelivery" ADD CONSTRAINT "DeveloperWebhookDelivery_outboxEventId_fkey" FOREIGN KEY ("outboxEventId") REFERENCES "DeveloperWebhookOutbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;
