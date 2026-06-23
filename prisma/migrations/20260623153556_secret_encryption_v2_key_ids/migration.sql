-- AlterTable
ALTER TABLE "DeveloperWebhookEndpoint" ADD COLUMN     "signingSecretEncryptedAt" TIMESTAMP(3),
ADD COLUMN     "signingSecretKeyId" TEXT;

-- AlterTable
ALTER TABLE "WhatsAppAccount" ADD COLUMN     "accessTokenEncryptedAt" TIMESTAMP(3),
ADD COLUMN     "accessTokenKeyId" TEXT;

-- CreateIndex
CREATE INDEX "DeveloperWebhookEndpoint_signingSecretKeyId_idx" ON "DeveloperWebhookEndpoint"("signingSecretKeyId");

-- CreateIndex
CREATE INDEX "WhatsAppAccount_accessTokenKeyId_idx" ON "WhatsAppAccount"("accessTokenKeyId");
