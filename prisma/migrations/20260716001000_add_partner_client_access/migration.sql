-- CreateEnum
CREATE TYPE "PartnerClientAccessPermission" AS ENUM (
    'CLIENT_VIEW',
    'CLIENT_SUPPORT',
    'CLIENT_BILLING_VIEW',
    'CLIENT_BILLING_MANAGE',
    'CLIENT_TEAM_MANAGE',
    'CLIENT_WHATSAPP_MANAGE',
    'CLIENT_CAMPAIGN_MANAGE',
    'CLIENT_SETTINGS_MANAGE'
);

-- CreateTable
CREATE TABLE "PartnerClientAccessGrant" (
    "id" TEXT NOT NULL,
    "partnerCompanyId" TEXT NOT NULL,
    "clientCompanyId" TEXT NOT NULL,
    "relationshipId" TEXT,
    "userId" TEXT NOT NULL,
    "grantedByUserId" TEXT,
    "permissions" "PartnerClientAccessPermission"[] NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerClientAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerClientAccessSession" (
    "id" TEXT NOT NULL,
    "partnerCompanyId" TEXT NOT NULL,
    "clientCompanyId" TEXT NOT NULL,
    "relationshipId" TEXT,
    "grantId" TEXT,
    "userId" TEXT NOT NULL,
    "permissions" "PartnerClientAccessPermission"[] NOT NULL,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerClientAccessSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerClientAccessGrant_clientCompanyId_userId_key" ON "PartnerClientAccessGrant"("clientCompanyId", "userId");

-- CreateIndex
CREATE INDEX "PartnerClientAccessGrant_partnerCompanyId_active_idx" ON "PartnerClientAccessGrant"("partnerCompanyId", "active");

-- CreateIndex
CREATE INDEX "PartnerClientAccessGrant_clientCompanyId_active_idx" ON "PartnerClientAccessGrant"("clientCompanyId", "active");

-- CreateIndex
CREATE INDEX "PartnerClientAccessGrant_relationshipId_idx" ON "PartnerClientAccessGrant"("relationshipId");

-- CreateIndex
CREATE INDEX "PartnerClientAccessGrant_userId_active_idx" ON "PartnerClientAccessGrant"("userId", "active");

-- CreateIndex
CREATE INDEX "PartnerClientAccessGrant_expiresAt_idx" ON "PartnerClientAccessGrant"("expiresAt");

-- CreateIndex
CREATE INDEX "PartnerClientAccessSession_partnerCompanyId_idx" ON "PartnerClientAccessSession"("partnerCompanyId");

-- CreateIndex
CREATE INDEX "PartnerClientAccessSession_clientCompanyId_idx" ON "PartnerClientAccessSession"("clientCompanyId");

-- CreateIndex
CREATE INDEX "PartnerClientAccessSession_relationshipId_idx" ON "PartnerClientAccessSession"("relationshipId");

-- CreateIndex
CREATE INDEX "PartnerClientAccessSession_grantId_idx" ON "PartnerClientAccessSession"("grantId");

-- CreateIndex
CREATE INDEX "PartnerClientAccessSession_userId_idx" ON "PartnerClientAccessSession"("userId");

-- CreateIndex
CREATE INDEX "PartnerClientAccessSession_expiresAt_idx" ON "PartnerClientAccessSession"("expiresAt");

-- CreateIndex
CREATE INDEX "PartnerClientAccessSession_endedAt_idx" ON "PartnerClientAccessSession"("endedAt");

-- AddForeignKey
ALTER TABLE "PartnerClientAccessGrant" ADD CONSTRAINT "PartnerClientAccessGrant_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerClientAccessGrant" ADD CONSTRAINT "PartnerClientAccessGrant_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerClientAccessGrant" ADD CONSTRAINT "PartnerClientAccessGrant_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "PartnerClientRelationship"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerClientAccessGrant" ADD CONSTRAINT "PartnerClientAccessGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerClientAccessGrant" ADD CONSTRAINT "PartnerClientAccessGrant_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerClientAccessSession" ADD CONSTRAINT "PartnerClientAccessSession_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerClientAccessSession" ADD CONSTRAINT "PartnerClientAccessSession_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerClientAccessSession" ADD CONSTRAINT "PartnerClientAccessSession_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "PartnerClientRelationship"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerClientAccessSession" ADD CONSTRAINT "PartnerClientAccessSession_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "PartnerClientAccessGrant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerClientAccessSession" ADD CONSTRAINT "PartnerClientAccessSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
