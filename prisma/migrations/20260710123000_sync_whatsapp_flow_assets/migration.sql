-- AlterTable
ALTER TABLE "WhatsAppFlow"
ADD COLUMN     "categories" JSONB,
ADD COLUMN     "isUsableForTemplates" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "metaRaw" JSONB,
ADD COLUMN     "remoteMissingAt" TIMESTAMP(3),
ADD COLUMN     "remoteStatus" TEXT,
ADD COLUMN     "validationErrors" JSONB,
ADD COLUMN     "whatsAppAccountId" TEXT;

-- Preserve existing manual/published imports as usable until the first Meta sync updates them.
UPDATE "WhatsAppFlow"
SET "isUsableForTemplates" = true,
    "remoteStatus" = "status"::TEXT
WHERE "status" = 'PUBLISHED';

-- AddForeignKey
ALTER TABLE "WhatsAppFlow"
ADD CONSTRAINT "WhatsAppFlow_whatsAppAccountId_fkey"
FOREIGN KEY ("whatsAppAccountId") REFERENCES "WhatsAppAccount"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "WhatsAppFlow_whatsAppAccountId_idx" ON "WhatsAppFlow"("whatsAppAccountId");

-- CreateIndex
CREATE INDEX "WhatsAppFlow_isUsableForTemplates_idx" ON "WhatsAppFlow"("isUsableForTemplates");

-- CreateIndex
CREATE INDEX "WhatsAppFlow_lastSyncedAt_idx" ON "WhatsAppFlow"("lastSyncedAt");

-- CreateIndex
CREATE INDEX "WhatsAppFlow_remoteMissingAt_idx" ON "WhatsAppFlow"("remoteMissingAt");
