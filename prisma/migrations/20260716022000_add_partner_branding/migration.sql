CREATE TYPE "PartnerBrandingStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'DISABLED');

CREATE TABLE "PartnerBranding" (
    "id" TEXT NOT NULL,
    "partnerCompanyId" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "companyName" TEXT,
    "logoUrl" TEXT,
    "logoDarkUrl" TEXT,
    "markUrl" TEXT,
    "faviconUrl" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "accentColor" TEXT,
    "backgroundColor" TEXT,
    "textColor" TEXT,
    "supportName" TEXT,
    "supportEmail" TEXT,
    "supportPhone" TEXT,
    "loginHeading" TEXT,
    "loginDescription" TEXT,
    "hideMetaWhatBranding" BOOLEAN NOT NULL DEFAULT false,
    "status" "PartnerBrandingStatus" NOT NULL DEFAULT 'DRAFT',
    "rejectionReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerBranding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerBranding_partnerCompanyId_key" ON "PartnerBranding"("partnerCompanyId");
CREATE INDEX "PartnerBranding_partnerCompanyId_status_idx" ON "PartnerBranding"("partnerCompanyId", "status");
CREATE INDEX "PartnerBranding_approvedByUserId_idx" ON "PartnerBranding"("approvedByUserId");
CREATE INDEX "PartnerBranding_status_idx" ON "PartnerBranding"("status");

ALTER TABLE "PartnerBranding" ADD CONSTRAINT "PartnerBranding_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerBranding" ADD CONSTRAINT "PartnerBranding_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
