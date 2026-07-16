-- CreateEnum
CREATE TYPE "PlatformApprovalRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PlatformApprovalRequestType" AS ENUM ('PARTNER_PAYOUT', 'PARTNER_DOMAIN', 'PARTNER_OFFBOARDING', 'PARTNER_CLIENT_TRANSFER', 'PLATFORM_SETTING', 'HIGH_RISK_ACTION');

-- CreateEnum
CREATE TYPE "PartnerOffboardingStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED', 'FAILED');

-- CreateEnum
CREATE TYPE "PartnerClientTransferStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELED', 'FAILED');

-- CreateEnum
CREATE TYPE "PartnerDomainOwnershipChallengeStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "PlatformApprovalRequest" (
    "id" TEXT NOT NULL,
    "type" "PlatformApprovalRequestType" NOT NULL,
    "status" "PlatformApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "companyId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "riskLevel" INTEGER NOT NULL DEFAULT 1,
    "requestedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "rejectedByUserId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerOffboardingRun" (
    "id" TEXT NOT NULL,
    "partnerCompanyId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "completedByUserId" TEXT,
    "approvalRequestId" TEXT,
    "status" "PartnerOffboardingStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT NOT NULL,
    "clientPolicy" TEXT NOT NULL DEFAULT 'KEEP_WITH_METAWHAT',
    "transferTargets" JSONB,
    "checklist" JSONB,
    "failureReason" TEXT,
    "metadata" JSONB,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerOffboardingRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerClientTransferRequest" (
    "id" TEXT NOT NULL,
    "fromPartnerCompanyId" TEXT NOT NULL,
    "toPartnerCompanyId" TEXT,
    "clientCompanyId" TEXT NOT NULL,
    "relationshipId" TEXT,
    "requestedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "completedByUserId" TEXT,
    "approvalRequestId" TEXT,
    "status" "PartnerClientTransferStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT NOT NULL,
    "transferMode" TEXT NOT NULL DEFAULT 'MOVE_TO_METAWHAT',
    "failureReason" TEXT,
    "metadata" JSONB,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerClientTransferRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerDomainOwnershipChallenge" (
    "id" TEXT NOT NULL,
    "partnerCompanyId" TEXT NOT NULL,
    "domainId" TEXT,
    "normalizedHost" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "txtName" TEXT NOT NULL,
    "txtValue" TEXT NOT NULL,
    "status" "PartnerDomainOwnershipChallengeStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastCheckedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerDomainOwnershipChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformApprovalRequest_type_status_idx" ON "PlatformApprovalRequest"("type", "status");

-- CreateIndex
CREATE INDEX "PlatformApprovalRequest_companyId_idx" ON "PlatformApprovalRequest"("companyId");

-- CreateIndex
CREATE INDEX "PlatformApprovalRequest_entityType_entityId_idx" ON "PlatformApprovalRequest"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "PlatformApprovalRequest_requestedByUserId_idx" ON "PlatformApprovalRequest"("requestedByUserId");

-- CreateIndex
CREATE INDEX "PlatformApprovalRequest_approvedByUserId_idx" ON "PlatformApprovalRequest"("approvedByUserId");

-- CreateIndex
CREATE INDEX "PlatformApprovalRequest_expiresAt_idx" ON "PlatformApprovalRequest"("expiresAt");

-- CreateIndex
CREATE INDEX "PlatformApprovalRequest_createdAt_idx" ON "PlatformApprovalRequest"("createdAt");

-- CreateIndex
CREATE INDEX "PartnerOffboardingRun_partnerCompanyId_status_idx" ON "PartnerOffboardingRun"("partnerCompanyId", "status");

-- CreateIndex
CREATE INDEX "PartnerOffboardingRun_createdByUserId_idx" ON "PartnerOffboardingRun"("createdByUserId");

-- CreateIndex
CREATE INDEX "PartnerOffboardingRun_approvedByUserId_idx" ON "PartnerOffboardingRun"("approvedByUserId");

-- CreateIndex
CREATE INDEX "PartnerOffboardingRun_approvalRequestId_idx" ON "PartnerOffboardingRun"("approvalRequestId");

-- CreateIndex
CREATE INDEX "PartnerOffboardingRun_createdAt_idx" ON "PartnerOffboardingRun"("createdAt");

-- CreateIndex
CREATE INDEX "PartnerClientTransferRequest_fromPartnerCompanyId_status_idx" ON "PartnerClientTransferRequest"("fromPartnerCompanyId", "status");

-- CreateIndex
CREATE INDEX "PartnerClientTransferRequest_toPartnerCompanyId_status_idx" ON "PartnerClientTransferRequest"("toPartnerCompanyId", "status");

-- CreateIndex
CREATE INDEX "PartnerClientTransferRequest_clientCompanyId_status_idx" ON "PartnerClientTransferRequest"("clientCompanyId", "status");

-- CreateIndex
CREATE INDEX "PartnerClientTransferRequest_relationshipId_idx" ON "PartnerClientTransferRequest"("relationshipId");

-- CreateIndex
CREATE INDEX "PartnerClientTransferRequest_approvalRequestId_idx" ON "PartnerClientTransferRequest"("approvalRequestId");

-- CreateIndex
CREATE INDEX "PartnerClientTransferRequest_createdAt_idx" ON "PartnerClientTransferRequest"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerDomainOwnershipChallenge_normalizedHost_token_key" ON "PartnerDomainOwnershipChallenge"("normalizedHost", "token");

-- CreateIndex
CREATE INDEX "PartnerDomainOwnershipChallenge_partnerCompanyId_status_idx" ON "PartnerDomainOwnershipChallenge"("partnerCompanyId", "status");

-- CreateIndex
CREATE INDEX "PartnerDomainOwnershipChallenge_domainId_idx" ON "PartnerDomainOwnershipChallenge"("domainId");

-- CreateIndex
CREATE INDEX "PartnerDomainOwnershipChallenge_normalizedHost_status_idx" ON "PartnerDomainOwnershipChallenge"("normalizedHost", "status");

-- CreateIndex
CREATE INDEX "PartnerDomainOwnershipChallenge_expiresAt_idx" ON "PartnerDomainOwnershipChallenge"("expiresAt");

-- AddForeignKey
ALTER TABLE "PlatformApprovalRequest" ADD CONSTRAINT "PlatformApprovalRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformApprovalRequest" ADD CONSTRAINT "PlatformApprovalRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformApprovalRequest" ADD CONSTRAINT "PlatformApprovalRequest_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformApprovalRequest" ADD CONSTRAINT "PlatformApprovalRequest_rejectedByUserId_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerOffboardingRun" ADD CONSTRAINT "PartnerOffboardingRun_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerOffboardingRun" ADD CONSTRAINT "PartnerOffboardingRun_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerOffboardingRun" ADD CONSTRAINT "PartnerOffboardingRun_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerOffboardingRun" ADD CONSTRAINT "PartnerOffboardingRun_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerOffboardingRun" ADD CONSTRAINT "PartnerOffboardingRun_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "PlatformApprovalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerClientTransferRequest" ADD CONSTRAINT "PartnerClientTransferRequest_fromPartnerCompanyId_fkey" FOREIGN KEY ("fromPartnerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerClientTransferRequest" ADD CONSTRAINT "PartnerClientTransferRequest_toPartnerCompanyId_fkey" FOREIGN KEY ("toPartnerCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerClientTransferRequest" ADD CONSTRAINT "PartnerClientTransferRequest_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerClientTransferRequest" ADD CONSTRAINT "PartnerClientTransferRequest_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "PartnerClientRelationship"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerClientTransferRequest" ADD CONSTRAINT "PartnerClientTransferRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerClientTransferRequest" ADD CONSTRAINT "PartnerClientTransferRequest_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerClientTransferRequest" ADD CONSTRAINT "PartnerClientTransferRequest_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerClientTransferRequest" ADD CONSTRAINT "PartnerClientTransferRequest_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "PlatformApprovalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerDomainOwnershipChallenge" ADD CONSTRAINT "PartnerDomainOwnershipChallenge_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerDomainOwnershipChallenge" ADD CONSTRAINT "PartnerDomainOwnershipChallenge_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "PartnerCustomDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;
