-- CreateEnum
CREATE TYPE "PartnerEmailBrandingStatus" AS ENUM (
    'DRAFT',
    'PENDING_DNS',
    'VERIFIED',
    'FAILED',
    'DISABLED'
);

-- AlterTable
ALTER TABLE "CompanyNotificationEmailDelivery"
ADD COLUMN "fromName" TEXT,
ADD COLUMN "fromEmail" TEXT,
ADD COLUMN "replyToEmail" TEXT,
ADD COLUMN "brandSnapshot" JSONB;

-- AlterTable
ALTER TABLE "BillingDocumentEmailDelivery"
ADD COLUMN "fromName" TEXT,
ADD COLUMN "fromEmail" TEXT,
ADD COLUMN "replyToEmail" TEXT,
ADD COLUMN "brandSnapshot" JSONB;

-- CreateTable
CREATE TABLE "PartnerEmailBranding" (
    "id" TEXT NOT NULL,
    "partnerCompanyId" TEXT NOT NULL,
    "fromName" TEXT,
    "fromAddress" TEXT,
    "replyTo" TEXT,
    "sendingDomain" TEXT,
    "providerDomainId" TEXT,
    "status" "PartnerEmailBrandingStatus" NOT NULL DEFAULT 'DRAFT',
    "spfVerified" BOOLEAN NOT NULL DEFAULT false,
    "dkimVerified" BOOLEAN NOT NULL DEFAULT false,
    "dmarcVerified" BOOLEAN NOT NULL DEFAULT false,
    "spfHost" TEXT,
    "spfValue" TEXT,
    "dkimHost" TEXT,
    "dkimValue" TEXT,
    "dmarcHost" TEXT,
    "dmarcValue" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "footerText" TEXT,
    "logoUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerEmailBranding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerEmailBranding_partnerCompanyId_key" ON "PartnerEmailBranding"("partnerCompanyId");

-- CreateIndex
CREATE INDEX "PartnerEmailBranding_partnerCompanyId_status_idx" ON "PartnerEmailBranding"("partnerCompanyId", "status");

-- CreateIndex
CREATE INDEX "PartnerEmailBranding_status_idx" ON "PartnerEmailBranding"("status");

-- CreateIndex
CREATE INDEX "PartnerEmailBranding_sendingDomain_idx" ON "PartnerEmailBranding"("sendingDomain");

-- AddForeignKey
ALTER TABLE "PartnerEmailBranding" ADD CONSTRAINT "PartnerEmailBranding_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
