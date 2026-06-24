-- CreateEnum
CREATE TYPE "ComplianceEvidenceExportType" AS ENUM ('COMPANY_COMPLIANCE', 'CONTACT_COMPLIANCE', 'PRIVACY_COMPLIANCE', 'SECURITY_COMPLIANCE', 'RETENTION_COMPLIANCE');

-- CreateEnum
CREATE TYPE "ComplianceEvidenceExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "ComplianceEvidenceExport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT,
    "requestedByUserId" TEXT,
    "type" "ComplianceEvidenceExportType" NOT NULL,
    "status" "ComplianceEvidenceExportStatus" NOT NULL DEFAULT 'PENDING',
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3) NOT NULL,
    "filePath" TEXT,
    "fileName" TEXT,
    "expiresAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceEvidenceExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComplianceEvidenceExport_companyId_idx" ON "ComplianceEvidenceExport"("companyId");

-- CreateIndex
CREATE INDEX "ComplianceEvidenceExport_contactId_idx" ON "ComplianceEvidenceExport"("contactId");

-- CreateIndex
CREATE INDEX "ComplianceEvidenceExport_requestedByUserId_idx" ON "ComplianceEvidenceExport"("requestedByUserId");

-- CreateIndex
CREATE INDEX "ComplianceEvidenceExport_type_idx" ON "ComplianceEvidenceExport"("type");

-- CreateIndex
CREATE INDEX "ComplianceEvidenceExport_status_idx" ON "ComplianceEvidenceExport"("status");

-- CreateIndex
CREATE INDEX "ComplianceEvidenceExport_dateFrom_idx" ON "ComplianceEvidenceExport"("dateFrom");

-- CreateIndex
CREATE INDEX "ComplianceEvidenceExport_dateTo_idx" ON "ComplianceEvidenceExport"("dateTo");

-- CreateIndex
CREATE INDEX "ComplianceEvidenceExport_expiresAt_idx" ON "ComplianceEvidenceExport"("expiresAt");

-- CreateIndex
CREATE INDEX "ComplianceEvidenceExport_createdAt_idx" ON "ComplianceEvidenceExport"("createdAt");

-- AddForeignKey
ALTER TABLE "ComplianceEvidenceExport" ADD CONSTRAINT "ComplianceEvidenceExport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceEvidenceExport" ADD CONSTRAINT "ComplianceEvidenceExport_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceEvidenceExport" ADD CONSTRAINT "ComplianceEvidenceExport_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
