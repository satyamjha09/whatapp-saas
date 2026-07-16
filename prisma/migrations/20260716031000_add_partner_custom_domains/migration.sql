-- CreateEnum
CREATE TYPE "PartnerCustomDomainStatus" AS ENUM (
    'REQUESTED',
    'PENDING_DNS',
    'DNS_VERIFIED',
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'DISABLED'
);

-- CreateEnum
CREATE TYPE "PartnerCustomDomainSslStatus" AS ENUM (
    'UNKNOWN',
    'PENDING',
    'ISSUED',
    'FAILED'
);

-- CreateEnum
CREATE TYPE "PartnerCustomDomainHealthStatus" AS ENUM (
    'UNKNOWN',
    'HEALTHY',
    'UNHEALTHY'
);

-- CreateTable
CREATE TABLE "PartnerCustomDomain" (
    "id" TEXT NOT NULL,
    "partnerCompanyId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "normalizedHost" TEXT NOT NULL,
    "verificationToken" TEXT NOT NULL,
    "verificationTxtName" TEXT NOT NULL,
    "verificationTxtValue" TEXT NOT NULL,
    "status" "PartnerCustomDomainStatus" NOT NULL DEFAULT 'REQUESTED',
    "sslStatus" "PartnerCustomDomainSslStatus" NOT NULL DEFAULT 'UNKNOWN',
    "healthStatus" "PartnerCustomDomainHealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "rejectionReason" TEXT,
    "dnsVerifiedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "disabledAt" TIMESTAMP(3),
    "lastDnsCheckAt" TIMESTAMP(3),
    "lastSslCheckAt" TIMESTAMP(3),
    "lastHostResolvedAt" TIMESTAMP(3),
    "lastHealthCheckAt" TIMESTAMP(3),
    "lastError" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerCustomDomain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerCustomDomain_normalizedHost_key" ON "PartnerCustomDomain"("normalizedHost");

-- CreateIndex
CREATE INDEX "PartnerCustomDomain_partnerCompanyId_status_idx" ON "PartnerCustomDomain"("partnerCompanyId", "status");

-- CreateIndex
CREATE INDEX "PartnerCustomDomain_approvedByUserId_idx" ON "PartnerCustomDomain"("approvedByUserId");

-- CreateIndex
CREATE INDEX "PartnerCustomDomain_status_idx" ON "PartnerCustomDomain"("status");

-- CreateIndex
CREATE INDEX "PartnerCustomDomain_healthStatus_idx" ON "PartnerCustomDomain"("healthStatus");

-- CreateIndex
CREATE INDEX "PartnerCustomDomain_sslStatus_idx" ON "PartnerCustomDomain"("sslStatus");

-- AddForeignKey
ALTER TABLE "PartnerCustomDomain" ADD CONSTRAINT "PartnerCustomDomain_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCustomDomain" ADD CONSTRAINT "PartnerCustomDomain_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
