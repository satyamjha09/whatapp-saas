-- AlterEnum
ALTER TYPE "DeveloperWebhookEndpointStatus" ADD VALUE 'AUTO_DISABLED';

-- AlterTable
ALTER TABLE "DeveloperWebhookEndpoint" ADD COLUMN     "autoDisabledAt" TIMESTAMP(3),
ADD COLUMN     "autoDisabledReason" TEXT,
ADD COLUMN     "consecutiveFailureCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastFailureAt" TIMESTAMP(3),
ADD COLUMN     "lastSuccessAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "DeveloperWebhookEndpoint_autoDisabledAt_idx" ON "DeveloperWebhookEndpoint"("autoDisabledAt");
