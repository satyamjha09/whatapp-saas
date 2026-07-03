-- Harden campaign launch safe sending with idempotency and recipient progress tracking.
ALTER TYPE "CampaignLaunchRecipientStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "CampaignLaunchRecipientStatus" ADD VALUE IF NOT EXISTS 'SENT';
ALTER TYPE "CampaignLaunchRecipientStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "CampaignLaunchRecipientStatus" ADD VALUE IF NOT EXISTS 'READ';
ALTER TYPE "CampaignLaunchRecipientStatus" ADD VALUE IF NOT EXISTS 'REPLIED';

ALTER TABLE "Message"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

ALTER TABLE "CampaignLaunchRecipient"
  ADD COLUMN IF NOT EXISTS "queuedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "repliedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "skippedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Message_companyId_idempotencyKey_key"
  ON "Message"("companyId", "idempotencyKey");

CREATE UNIQUE INDEX IF NOT EXISTS "CampaignLaunchRecipient_launchRunId_contactId_key"
  ON "CampaignLaunchRecipient"("launchRunId", "contactId");
