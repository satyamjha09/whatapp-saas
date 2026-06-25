-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('NONE', 'SUPPORT', 'FINANCE', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "CompanyType" AS ENUM ('DIRECT_COMPANY', 'PARTNER', 'PARTNER_CLIENT');

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED', 'PENDING_ONBOARDING');

-- CreateEnum
CREATE TYPE "CompanyBillingOwnerType" AS ENUM ('SELF', 'PARENT_PARTNER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "platformRole" "PlatformRole" NOT NULL DEFAULT 'NONE',
ADD COLUMN "platformAccessEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN "type" "CompanyType" NOT NULL DEFAULT 'DIRECT_COMPANY',
ADD COLUMN "status" "CompanyStatus" NOT NULL DEFAULT 'PENDING_ONBOARDING',
ADD COLUMN "parentCompanyId" TEXT,
ADD COLUMN "billingOwnerType" "CompanyBillingOwnerType" NOT NULL DEFAULT 'SELF',
ADD COLUMN "legalName" TEXT,
ADD COLUMN "brandName" TEXT,
ADD COLUMN "industry" TEXT,
ADD COLUMN "website" TEXT,
ADD COLUMN "supportEmail" TEXT,
ADD COLUMN "supportPhone" TEXT,
ADD COLUMN "isSandbox" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN "suspendedAt" TIMESTAMP(3),
ADD COLUMN "suspensionReason" TEXT,
ADD COLUMN "platformNotes" TEXT;

-- CreateIndex
CREATE INDEX "Company_type_idx" ON "Company"("type");

-- CreateIndex
CREATE INDEX "Company_status_idx" ON "Company"("status");

-- CreateIndex
CREATE INDEX "Company_parentCompanyId_idx" ON "Company"("parentCompanyId");

-- CreateIndex
CREATE INDEX "Company_billingOwnerType_idx" ON "Company"("billingOwnerType");

-- CreateIndex
CREATE INDEX "Company_isSandbox_idx" ON "Company"("isSandbox");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_parentCompanyId_fkey" FOREIGN KEY ("parentCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
