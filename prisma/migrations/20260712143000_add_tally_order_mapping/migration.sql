-- Add order sync fields and Tally mapping foundation.
CREATE TYPE "OrderSyncStatus" AS ENUM ('LOCAL_ONLY', 'SYNCED', 'NEEDS_REVIEW', 'FAILED');
CREATE TYPE "TallyMappingMatchSource" AS ENUM ('EXPLICIT', 'GSTIN', 'PHONE', 'EMAIL', 'LEDGER_NAME', 'SKU', 'RETAILER_ID', 'STOCK_ITEM_NAME', 'MANUAL_REVIEW');
CREATE TYPE "TallyOrderSyncRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'PARTIAL_FAILED', 'FAILED');

ALTER TABLE "Order"
  ADD COLUMN "externalCompanyId" TEXT,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "syncStatus" "OrderSyncStatus" NOT NULL DEFAULT 'LOCAL_ONLY',
  ADD COLUMN "syncError" TEXT,
  ADD COLUMN "lastSyncedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Order_companyId_source_externalOrderId_key" ON "Order"("companyId", "source", "externalOrderId");
CREATE INDEX "Order_companyId_externalCompanyId_idx" ON "Order"("companyId", "externalCompanyId");
CREATE INDEX "Order_companyId_syncStatus_idx" ON "Order"("companyId", "syncStatus");
CREATE INDEX "Order_companyId_lastSyncedAt_idx" ON "Order"("companyId", "lastSyncedAt");

CREATE TABLE "TallyCustomerMapping" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "tallyCompanyId" TEXT NOT NULL,
  "tallyLedgerId" TEXT NOT NULL,
  "tallyLedgerName" TEXT NOT NULL,
  "contactId" TEXT,
  "matchSource" "TallyMappingMatchSource" NOT NULL DEFAULT 'MANUAL_REVIEW',
  "confidence" INTEGER NOT NULL DEFAULT 0,
  "lastSyncedAt" TIMESTAMP(3),
  "updatedByUserId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TallyCustomerMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TallyProductMapping" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "tallyCompanyId" TEXT NOT NULL,
  "tallyStockItemId" TEXT NOT NULL,
  "tallyStockItemName" TEXT NOT NULL,
  "localProductId" TEXT,
  "matchSource" "TallyMappingMatchSource" NOT NULL DEFAULT 'MANUAL_REVIEW',
  "lastSyncedAt" TIMESTAMP(3),
  "updatedByUserId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TallyProductMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TallyOrderSyncRun" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "tallyCompanyId" TEXT NOT NULL,
  "status" "TallyOrderSyncRunStatus" NOT NULL DEFAULT 'RUNNING',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "ordersFound" INTEGER NOT NULL DEFAULT 0,
  "createdCount" INTEGER NOT NULL DEFAULT 0,
  "updatedCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "unmappedCustomerCount" INTEGER NOT NULL DEFAULT 0,
  "unmappedProductCount" INTEGER NOT NULL DEFAULT 0,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "summary" JSONB,
  CONSTRAINT "TallyOrderSyncRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TallyCustomerMapping_companyId_tallyCompanyId_tallyLedgerId_key" ON "TallyCustomerMapping"("companyId", "tallyCompanyId", "tallyLedgerId");
CREATE INDEX "TallyCustomerMapping_companyId_idx" ON "TallyCustomerMapping"("companyId");
CREATE INDEX "TallyCustomerMapping_tallyCompanyId_idx" ON "TallyCustomerMapping"("tallyCompanyId");
CREATE INDEX "TallyCustomerMapping_contactId_idx" ON "TallyCustomerMapping"("contactId");
CREATE INDEX "TallyCustomerMapping_matchSource_idx" ON "TallyCustomerMapping"("matchSource");
CREATE INDEX "TallyCustomerMapping_lastSyncedAt_idx" ON "TallyCustomerMapping"("lastSyncedAt");

CREATE UNIQUE INDEX "TallyProductMapping_companyId_tallyCompanyId_tallyStockItemId_key" ON "TallyProductMapping"("companyId", "tallyCompanyId", "tallyStockItemId");
CREATE INDEX "TallyProductMapping_companyId_idx" ON "TallyProductMapping"("companyId");
CREATE INDEX "TallyProductMapping_tallyCompanyId_idx" ON "TallyProductMapping"("tallyCompanyId");
CREATE INDEX "TallyProductMapping_localProductId_idx" ON "TallyProductMapping"("localProductId");
CREATE INDEX "TallyProductMapping_matchSource_idx" ON "TallyProductMapping"("matchSource");
CREATE INDEX "TallyProductMapping_lastSyncedAt_idx" ON "TallyProductMapping"("lastSyncedAt");

CREATE INDEX "TallyOrderSyncRun_companyId_idx" ON "TallyOrderSyncRun"("companyId");
CREATE INDEX "TallyOrderSyncRun_tallyCompanyId_idx" ON "TallyOrderSyncRun"("tallyCompanyId");
CREATE INDEX "TallyOrderSyncRun_status_idx" ON "TallyOrderSyncRun"("status");
CREATE INDEX "TallyOrderSyncRun_startedAt_idx" ON "TallyOrderSyncRun"("startedAt");

ALTER TABLE "TallyCustomerMapping" ADD CONSTRAINT "TallyCustomerMapping_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TallyCustomerMapping" ADD CONSTRAINT "TallyCustomerMapping_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TallyCustomerMapping" ADD CONSTRAINT "TallyCustomerMapping_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TallyProductMapping" ADD CONSTRAINT "TallyProductMapping_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TallyProductMapping" ADD CONSTRAINT "TallyProductMapping_localProductId_fkey" FOREIGN KEY ("localProductId") REFERENCES "WhatsAppCatalogProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TallyProductMapping" ADD CONSTRAINT "TallyProductMapping_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TallyOrderSyncRun" ADD CONSTRAINT "TallyOrderSyncRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
