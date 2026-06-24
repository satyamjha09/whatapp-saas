CREATE TYPE "TrustDocumentType" AS ENUM ('TERMS_OF_SERVICE', 'PRIVACY_POLICY', 'DATA_PROCESSING_AGREEMENT');

CREATE TYPE "TrustDocumentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TYPE "TrustDocumentAcceptanceSource" AS ENUM ('DASHBOARD', 'PUBLIC_API', 'MANUAL');

CREATE TABLE "TrustDocument" (
    "id" TEXT NOT NULL,
    "type" "TrustDocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "status" "TrustDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "effectiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrustDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrustDocumentAcceptance" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "documentId" TEXT NOT NULL,
    "documentType" "TrustDocumentType" NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "documentHash" TEXT NOT NULL,
    "source" "TrustDocumentAcceptanceSource" NOT NULL DEFAULT 'DASHBOARD',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrustDocumentAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrustDocument_slug_version_key" ON "TrustDocument"("slug", "version");
CREATE INDEX "TrustDocument_type_idx" ON "TrustDocument"("type");
CREATE INDEX "TrustDocument_status_idx" ON "TrustDocument"("status");
CREATE INDEX "TrustDocument_publishedAt_idx" ON "TrustDocument"("publishedAt");
CREATE UNIQUE INDEX "TrustDocumentAcceptance_companyId_documentId_key" ON "TrustDocumentAcceptance"("companyId", "documentId");
CREATE INDEX "TrustDocumentAcceptance_companyId_idx" ON "TrustDocumentAcceptance"("companyId");
CREATE INDEX "TrustDocumentAcceptance_userId_idx" ON "TrustDocumentAcceptance"("userId");
CREATE INDEX "TrustDocumentAcceptance_documentId_idx" ON "TrustDocumentAcceptance"("documentId");
CREATE INDEX "TrustDocumentAcceptance_documentType_idx" ON "TrustDocumentAcceptance"("documentType");
CREATE INDEX "TrustDocumentAcceptance_acceptedAt_idx" ON "TrustDocumentAcceptance"("acceptedAt");

ALTER TABLE "TrustDocumentAcceptance" ADD CONSTRAINT "TrustDocumentAcceptance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrustDocumentAcceptance" ADD CONSTRAINT "TrustDocumentAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrustDocumentAcceptance" ADD CONSTRAINT "TrustDocumentAcceptance_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "TrustDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
