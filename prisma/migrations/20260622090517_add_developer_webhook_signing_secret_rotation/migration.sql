-- AlterTable
ALTER TABLE "DeveloperWebhookEndpoint" ADD COLUMN     "signingSecretPreview" TEXT,
ADD COLUMN     "signingSecretRotatedAt" TIMESTAMP(3);
