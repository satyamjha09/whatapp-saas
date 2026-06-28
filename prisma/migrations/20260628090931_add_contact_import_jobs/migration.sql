-- CreateEnum
CREATE TYPE "ContactImportJobStatus" AS ENUM ('DRAFT', 'PREVIEWED', 'IMPORTING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ContactImportRowStatus" AS ENUM ('READY', 'SKIPPED', 'IMPORTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ContactImportDuplicateStrategy" AS ENUM ('UPDATE_EXISTING', 'SKIP_EXISTING');

-- CreateTable
CREATE TABLE "ContactImportJob" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "status" "ContactImportJobStatus" NOT NULL DEFAULT 'DRAFT',
    "duplicateStrategy" "ContactImportDuplicateStrategy" NOT NULL DEFAULT 'UPDATE_EXISTING',
    "fileName" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "readyRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "fieldMapping" JSONB,
    "consentMapping" JSONB,
    "previewSummary" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactImportRow" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "status" "ContactImportRowStatus" NOT NULL DEFAULT 'READY',
    "raw" JSONB,
    "normalized" JSONB,
    "phone" TEXT,
    "email" TEXT,
    "name" TEXT,
    "contactId" TEXT,
    "errorMessage" TEXT,
    "consentStatus" TEXT,
    "consentProof" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactImportJob_companyId_idx" ON "ContactImportJob"("companyId");

-- CreateIndex
CREATE INDEX "ContactImportJob_actorUserId_idx" ON "ContactImportJob"("actorUserId");

-- CreateIndex
CREATE INDEX "ContactImportJob_status_idx" ON "ContactImportJob"("status");

-- CreateIndex
CREATE INDEX "ContactImportJob_createdAt_idx" ON "ContactImportJob"("createdAt");

-- CreateIndex
CREATE INDEX "ContactImportRow_companyId_idx" ON "ContactImportRow"("companyId");

-- CreateIndex
CREATE INDEX "ContactImportRow_jobId_idx" ON "ContactImportRow"("jobId");

-- CreateIndex
CREATE INDEX "ContactImportRow_contactId_idx" ON "ContactImportRow"("contactId");

-- CreateIndex
CREATE INDEX "ContactImportRow_status_idx" ON "ContactImportRow"("status");

-- CreateIndex
CREATE INDEX "ContactImportRow_phone_idx" ON "ContactImportRow"("phone");

-- CreateIndex
CREATE INDEX "ContactImportRow_email_idx" ON "ContactImportRow"("email");

-- CreateIndex
CREATE INDEX "ContactImportRow_rowNumber_idx" ON "ContactImportRow"("rowNumber");

-- AddForeignKey
ALTER TABLE "ContactImportJob" ADD CONSTRAINT "ContactImportJob_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactImportJob" ADD CONSTRAINT "ContactImportJob_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactImportRow" ADD CONSTRAINT "ContactImportRow_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactImportRow" ADD CONSTRAINT "ContactImportRow_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ContactImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactImportRow" ADD CONSTRAINT "ContactImportRow_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
