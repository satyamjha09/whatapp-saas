-- Add idempotent keys for contact timeline activity backfills and live campaign events.
ALTER TABLE "ContactActivity" ADD COLUMN "dedupeKey" TEXT;

CREATE UNIQUE INDEX "ContactActivity_dedupeKey_key" ON "ContactActivity"("dedupeKey");
