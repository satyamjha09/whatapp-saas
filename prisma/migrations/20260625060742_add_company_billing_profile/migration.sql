-- CreateEnum
CREATE TYPE "BillingProfileVerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BillingProfileUpdateSource" AS ENUM ('CUSTOMER', 'ADMIN', 'SYSTEM');

-- CreateTable
CREATE TABLE "CompanyBillingProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "legalName" TEXT,
    "billingEmail" TEXT,
    "billingPhone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "taxIdLabel" TEXT,
    "taxId" TEXT,
    "invoiceNotes" TEXT,
    "verificationStatus" "BillingProfileVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "lastUpdatedByUserId" TEXT,
    "lastUpdatedSource" "BillingProfileUpdateSource" NOT NULL DEFAULT 'CUSTOMER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyBillingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingProfileUpdateEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "source" "BillingProfileUpdateSource" NOT NULL,
    "previousData" JSONB,
    "newData" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingProfileUpdateEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyBillingProfile_companyId_key" ON "CompanyBillingProfile"("companyId");

-- CreateIndex
CREATE INDEX "CompanyBillingProfile_companyId_idx" ON "CompanyBillingProfile"("companyId");

-- CreateIndex
CREATE INDEX "CompanyBillingProfile_billingEmail_idx" ON "CompanyBillingProfile"("billingEmail");

-- CreateIndex
CREATE INDEX "CompanyBillingProfile_taxId_idx" ON "CompanyBillingProfile"("taxId");

-- CreateIndex
CREATE INDEX "CompanyBillingProfile_verificationStatus_idx" ON "CompanyBillingProfile"("verificationStatus");

-- CreateIndex
CREATE INDEX "BillingProfileUpdateEvent_companyId_idx" ON "BillingProfileUpdateEvent"("companyId");

-- CreateIndex
CREATE INDEX "BillingProfileUpdateEvent_profileId_idx" ON "BillingProfileUpdateEvent"("profileId");

-- CreateIndex
CREATE INDEX "BillingProfileUpdateEvent_actorUserId_idx" ON "BillingProfileUpdateEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "BillingProfileUpdateEvent_source_idx" ON "BillingProfileUpdateEvent"("source");

-- CreateIndex
CREATE INDEX "BillingProfileUpdateEvent_createdAt_idx" ON "BillingProfileUpdateEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "CompanyBillingProfile" ADD CONSTRAINT "CompanyBillingProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyBillingProfile" ADD CONSTRAINT "CompanyBillingProfile_lastUpdatedByUserId_fkey" FOREIGN KEY ("lastUpdatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingProfileUpdateEvent" ADD CONSTRAINT "BillingProfileUpdateEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingProfileUpdateEvent" ADD CONSTRAINT "BillingProfileUpdateEvent_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CompanyBillingProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingProfileUpdateEvent" ADD CONSTRAINT "BillingProfileUpdateEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
