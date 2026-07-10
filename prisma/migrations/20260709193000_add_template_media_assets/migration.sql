-- Store reusable media samples for WhatsApp template headers.
CREATE TABLE "TemplateMediaAsset" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "uploadedByUserId" TEXT,
  "mediaType" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "publicUrl" TEXT NOT NULL,
  "sha256" TEXT,
  "metaHandle" TEXT,
  "metaRaw" JSONB,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TemplateMediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TemplateMediaAsset_storageKey_key" ON "TemplateMediaAsset"("storageKey");
CREATE INDEX "TemplateMediaAsset_companyId_idx" ON "TemplateMediaAsset"("companyId");
CREATE INDEX "TemplateMediaAsset_uploadedByUserId_idx" ON "TemplateMediaAsset"("uploadedByUserId");
CREATE INDEX "TemplateMediaAsset_mediaType_idx" ON "TemplateMediaAsset"("mediaType");
CREATE INDEX "TemplateMediaAsset_status_idx" ON "TemplateMediaAsset"("status");
CREATE INDEX "TemplateMediaAsset_createdAt_idx" ON "TemplateMediaAsset"("createdAt");

ALTER TABLE "TemplateMediaAsset"
  ADD CONSTRAINT "TemplateMediaAsset_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TemplateMediaAsset"
  ADD CONSTRAINT "TemplateMediaAsset_uploadedByUserId_fkey"
  FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
