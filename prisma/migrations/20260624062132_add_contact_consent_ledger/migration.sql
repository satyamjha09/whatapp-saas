-- CreateEnum
CREATE TYPE "ContactConsentType" AS ENUM ('WHATSAPP_MARKETING', 'WHATSAPP_UTILITY', 'WHATSAPP_SERVICE', 'DATA_PROCESSING');

-- CreateEnum
CREATE TYPE "ContactConsentStatus" AS ENUM ('GRANTED', 'REVOKED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ContactConsentSource" AS ENUM ('DASHBOARD', 'IMPORT', 'PUBLIC_API', 'WHATSAPP_KEYWORD', 'PUBLIC_FORM', 'SYSTEM');

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "marketingConsentAt" TIMESTAMP(3),
ADD COLUMN     "marketingConsentSource" "ContactConsentSource",
ADD COLUMN     "marketingConsentStatus" "ContactConsentStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "utilityConsentAt" TIMESTAMP(3),
ADD COLUMN     "utilityConsentSource" "ContactConsentSource",
ADD COLUMN     "utilityConsentStatus" "ContactConsentStatus" NOT NULL DEFAULT 'UNKNOWN';

-- CreateTable
CREATE TABLE "ContactConsentEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "type" "ContactConsentType" NOT NULL,
    "status" "ContactConsentStatus" NOT NULL,
    "source" "ContactConsentSource" NOT NULL,
    "actorUserId" TEXT,
    "evidenceText" TEXT,
    "evidenceUrl" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactConsentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactConsentEvent_companyId_idx" ON "ContactConsentEvent"("companyId");

-- CreateIndex
CREATE INDEX "ContactConsentEvent_contactId_idx" ON "ContactConsentEvent"("contactId");

-- CreateIndex
CREATE INDEX "ContactConsentEvent_actorUserId_idx" ON "ContactConsentEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "ContactConsentEvent_type_idx" ON "ContactConsentEvent"("type");

-- CreateIndex
CREATE INDEX "ContactConsentEvent_status_idx" ON "ContactConsentEvent"("status");

-- CreateIndex
CREATE INDEX "ContactConsentEvent_source_idx" ON "ContactConsentEvent"("source");

-- CreateIndex
CREATE INDEX "ContactConsentEvent_createdAt_idx" ON "ContactConsentEvent"("createdAt");

-- CreateIndex
CREATE INDEX "Contact_companyId_marketingConsentStatus_idx" ON "Contact"("companyId", "marketingConsentStatus");

-- CreateIndex
CREATE INDEX "Contact_companyId_utilityConsentStatus_idx" ON "Contact"("companyId", "utilityConsentStatus");

-- CreateIndex
CREATE INDEX "Contact_marketingConsentAt_idx" ON "Contact"("marketingConsentAt");

-- AddForeignKey
ALTER TABLE "ContactConsentEvent" ADD CONSTRAINT "ContactConsentEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactConsentEvent" ADD CONSTRAINT "ContactConsentEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactConsentEvent" ADD CONSTRAINT "ContactConsentEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
