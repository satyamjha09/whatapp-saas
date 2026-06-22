-- AlterTable
ALTER TABLE "DeveloperWebhookEndpoint" ADD COLUMN     "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "payloadVersion" TEXT NOT NULL DEFAULT '2026-06-01';
