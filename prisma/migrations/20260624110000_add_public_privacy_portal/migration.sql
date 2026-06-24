-- CreateEnum
CREATE TYPE "PublicPrivacyVerificationStatus" AS ENUM ('PENDING', 'USED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "PublicPrivacyRequestIntent" AS ENUM ('CONTACT_EXPORT', 'CONTACT_DELETE');

-- CreateTable
CREATE TABLE "PublicPrivacyVerification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "email" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "countryCode" TEXT,
    "intent" "PublicPrivacyRequestIntent" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "PublicPrivacyVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "requesterIp" TEXT,
    "userAgent" TEXT,
    "reason" TEXT,
    "privacyRequestId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicPrivacyVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicPrivacyVerification_companyId_idx" ON "PublicPrivacyVerification"("companyId");

-- CreateIndex
CREATE INDEX "PublicPrivacyVerification_emailHash_idx" ON "PublicPrivacyVerification"("emailHash");

-- CreateIndex
CREATE INDEX "PublicPrivacyVerification_tokenHash_idx" ON "PublicPrivacyVerification"("tokenHash");

-- CreateIndex
CREATE INDEX "PublicPrivacyVerification_status_idx" ON "PublicPrivacyVerification"("status");

-- CreateIndex
CREATE INDEX "PublicPrivacyVerification_intent_idx" ON "PublicPrivacyVerification"("intent");

-- CreateIndex
CREATE INDEX "PublicPrivacyVerification_expiresAt_idx" ON "PublicPrivacyVerification"("expiresAt");

-- CreateIndex
CREATE INDEX "PublicPrivacyVerification_createdAt_idx" ON "PublicPrivacyVerification"("createdAt");
