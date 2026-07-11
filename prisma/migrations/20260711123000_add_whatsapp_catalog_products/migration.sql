-- CreateTable
CREATE TABLE "WhatsAppCatalogProduct" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "metaProductId" TEXT NOT NULL,
    "retailerId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brand" TEXT,
    "category" TEXT,
    "imageUrl" TEXT,
    "productUrl" TEXT,
    "priceAmount" DECIMAL(20,6),
    "currency" TEXT,
    "availability" TEXT,
    "condition" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isUsable" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "remoteMissingAt" TIMESTAMP(3),
    "metaRaw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppCatalogProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppCatalogProduct_catalogId_metaProductId_key" ON "WhatsAppCatalogProduct"("catalogId", "metaProductId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppCatalogProduct_catalogId_retailerId_key" ON "WhatsAppCatalogProduct"("catalogId", "retailerId");

-- CreateIndex
CREATE INDEX "WhatsAppCatalogProduct_companyId_idx" ON "WhatsAppCatalogProduct"("companyId");

-- CreateIndex
CREATE INDEX "WhatsAppCatalogProduct_catalogId_idx" ON "WhatsAppCatalogProduct"("catalogId");

-- CreateIndex
CREATE INDEX "WhatsAppCatalogProduct_metaProductId_idx" ON "WhatsAppCatalogProduct"("metaProductId");

-- CreateIndex
CREATE INDEX "WhatsAppCatalogProduct_retailerId_idx" ON "WhatsAppCatalogProduct"("retailerId");

-- CreateIndex
CREATE INDEX "WhatsAppCatalogProduct_availability_idx" ON "WhatsAppCatalogProduct"("availability");

-- CreateIndex
CREATE INDEX "WhatsAppCatalogProduct_isUsable_idx" ON "WhatsAppCatalogProduct"("isUsable");

-- CreateIndex
CREATE INDEX "WhatsAppCatalogProduct_lastSyncedAt_idx" ON "WhatsAppCatalogProduct"("lastSyncedAt");

-- AddForeignKey
ALTER TABLE "WhatsAppCatalogProduct" ADD CONSTRAINT "WhatsAppCatalogProduct_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppCatalogProduct" ADD CONSTRAINT "WhatsAppCatalogProduct_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "WhatsAppCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
