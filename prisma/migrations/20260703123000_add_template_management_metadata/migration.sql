-- Add production-readiness metadata for WhatsApp template submission and sync.
ALTER TABLE "Template"
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "qualityScore" TEXT,
  ADD COLUMN "submittedPayload" JSONB,
  ADD COLUMN "lastSubmitError" TEXT,
  ADD COLUMN "lastSubmittedAt" TIMESTAMP(3),
  ADD COLUMN "submittedByUserId" TEXT,
  ADD COLUMN "lastSyncedAt" TIMESTAMP(3);
