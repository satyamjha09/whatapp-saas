-- AlterTable
ALTER TABLE "MessageEvent" ADD COLUMN     "dedupeKey" TEXT;

-- AlterTable
ALTER TABLE "WebhookEvent" ADD COLUMN     "dedupeKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MessageEvent_dedupeKey_key" ON "MessageEvent"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_dedupeKey_key" ON "WebhookEvent"("dedupeKey");
