-- CreateEnum
CREATE TYPE "PrivacyRequestType" AS ENUM ('CONTACT_EXPORT', 'CONTACT_DELETE', 'COMPANY_EXPORT');

-- CreateEnum
CREATE TYPE "PrivacyRequestStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PrivacyRequestSource" AS ENUM ('DASHBOARD', 'PUBLIC_API', 'MANUAL', 'SYSTEM');

-- CreateTable
CREATE TABLE "PrivacyRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT,
    "requestedByUserId" TEXT,
    "type" "PrivacyRequestType" NOT NULL,
    "status" "PrivacyRequestStatus" NOT NULL DEFAULT 'PENDING',
    "source" "PrivacyRequestSource" NOT NULL DEFAULT 'DASHBOARD',
    "requesterEmail" TEXT,
    "reason" TEXT,
    "confirmationText" TEXT,
    "exportFilePath" TEXT,
    "exportFileName" TEXT,
    "exportExpiresAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrivacyRequest_companyId_idx" ON "PrivacyRequest"("companyId");

-- CreateIndex
CREATE INDEX "PrivacyRequest_contactId_idx" ON "PrivacyRequest"("contactId");

-- CreateIndex
CREATE INDEX "PrivacyRequest_requestedByUserId_idx" ON "PrivacyRequest"("requestedByUserId");

-- CreateIndex
CREATE INDEX "PrivacyRequest_type_idx" ON "PrivacyRequest"("type");

-- CreateIndex
CREATE INDEX "PrivacyRequest_status_idx" ON "PrivacyRequest"("status");

-- CreateIndex
CREATE INDEX "PrivacyRequest_source_idx" ON "PrivacyRequest"("source");

-- CreateIndex
CREATE INDEX "PrivacyRequest_createdAt_idx" ON "PrivacyRequest"("createdAt");

-- CreateIndex
CREATE INDEX "PrivacyRequest_exportExpiresAt_idx" ON "PrivacyRequest"("exportExpiresAt");

-- AddForeignKey
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
