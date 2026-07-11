-- CreateEnum
CREATE TYPE "WhatsAppCatalogStatus" AS ENUM ('CONNECTED', 'MISSING', 'ERROR');

-- CreateTable
CREATE TABLE "WhatsAppCatalog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "whatsAppAccountId" TEXT NOT NULL,
    "metaCatalogId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vertical" TEXT,
    "productCount" INTEGER NOT NULL DEFAULT 0,
    "status" "WhatsAppCatalogStatus" NOT NULL DEFAULT 'CONNECTED',
    "isUsable" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "remoteMissingAt" TIMESTAMP(3),
    "metaRaw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppCatalog_companyId_metaCatalogId_key" ON "WhatsAppCatalog"("companyId", "metaCatalogId");

-- CreateIndex
CREATE INDEX "WhatsAppCatalog_companyId_idx" ON "WhatsAppCatalog"("companyId");

-- CreateIndex
CREATE INDEX "WhatsAppCatalog_whatsAppAccountId_idx" ON "WhatsAppCatalog"("whatsAppAccountId");

-- CreateIndex
CREATE INDEX "WhatsAppCatalog_metaCatalogId_idx" ON "WhatsAppCatalog"("metaCatalogId");

-- CreateIndex
CREATE INDEX "WhatsAppCatalog_status_idx" ON "WhatsAppCatalog"("status");

-- CreateIndex
CREATE INDEX "WhatsAppCatalog_isUsable_idx" ON "WhatsAppCatalog"("isUsable");

-- CreateIndex
CREATE INDEX "WhatsAppCatalog_lastSyncedAt_idx" ON "WhatsAppCatalog"("lastSyncedAt");

-- AddForeignKey
ALTER TABLE "WhatsAppCatalog" ADD CONSTRAINT "WhatsAppCatalog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppCatalog" ADD CONSTRAINT "WhatsAppCatalog_whatsAppAccountId_fkey" FOREIGN KEY ("whatsAppAccountId") REFERENCES "WhatsAppAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
