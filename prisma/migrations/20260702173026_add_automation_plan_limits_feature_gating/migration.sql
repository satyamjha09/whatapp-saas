-- CreateTable
CREATE TABLE "AutomationUsageCounter" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "executionsUsed" INTEGER NOT NULL DEFAULT 0,
    "testRunsUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationUsageCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyFeatureOverride" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyFeatureOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationUsageCounter_companyId_idx" ON "AutomationUsageCounter"("companyId");

-- CreateIndex
CREATE INDEX "AutomationUsageCounter_periodStart_periodEnd_idx" ON "AutomationUsageCounter"("periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationUsageCounter_companyId_periodStart_periodEnd_key" ON "AutomationUsageCounter"("companyId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "CompanyFeatureOverride_companyId_idx" ON "CompanyFeatureOverride"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyFeatureOverride_companyId_featureKey_key" ON "CompanyFeatureOverride"("companyId", "featureKey");

-- AddForeignKey
ALTER TABLE "AutomationUsageCounter" ADD CONSTRAINT "AutomationUsageCounter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyFeatureOverride" ADD CONSTRAINT "CompanyFeatureOverride_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
