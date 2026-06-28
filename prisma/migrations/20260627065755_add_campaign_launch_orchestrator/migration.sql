-- CreateEnum
CREATE TYPE "CampaignLaunchRunStatus" AS ENUM ('DRAFT', 'DRY_RUN_CREATED', 'DRY_RUN_CONFIRMED', 'WALLET_RESERVED', 'QUEUING', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "CampaignLaunchRecipientStatus" AS ENUM ('PLANNED', 'MESSAGE_CREATED', 'QUEUED', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "CampaignWalletReservationStatus" AS ENUM ('RESERVED', 'RELEASED', 'CONSUMED', 'FAILED');

-- CreateTable
CREATE TABLE "CampaignLaunchRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "status" "CampaignLaunchRunStatus" NOT NULL DEFAULT 'DRAFT',
    "idempotencyKey" TEXT,
    "templateId" TEXT,
    "templateName" TEXT NOT NULL,
    "templateLanguage" TEXT,
    "templateBody" TEXT NOT NULL,
    "templateCategory" TEXT,
    "segmentId" TEXT,
    "dryRunId" TEXT,
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "validRecipients" INTEGER NOT NULL DEFAULT 0,
    "skippedRecipients" INTEGER NOT NULL DEFAULT 0,
    "failedRecipients" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostPaise" INTEGER NOT NULL DEFAULT 0,
    "reservedAmountPaise" INTEGER NOT NULL DEFAULT 0,
    "queuedMessageCount" INTEGER NOT NULL DEFAULT 0,
    "createdMessageCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "queuedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignLaunchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignLaunchRecipient" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "launchRunId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT,
    "messageId" TEXT,
    "status" "CampaignLaunchRecipientStatus" NOT NULL DEFAULT 'PLANNED',
    "phoneMasked" TEXT,
    "phoneLast4" TEXT,
    "variables" JSONB,
    "bodyParameters" JSONB,
    "renderedPreview" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignLaunchRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignWalletReservation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "launchRunId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "status" "CampaignWalletReservationStatus" NOT NULL DEFAULT 'RESERVED',
    "amountPaise" INTEGER NOT NULL DEFAULT 0,
    "consumedAmountPaise" INTEGER NOT NULL DEFAULT 0,
    "releasedAmountPaise" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignWalletReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignLaunchRun_companyId_idx" ON "CampaignLaunchRun"("companyId");

-- CreateIndex
CREATE INDEX "CampaignLaunchRun_campaignId_idx" ON "CampaignLaunchRun"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignLaunchRun_createdByUserId_idx" ON "CampaignLaunchRun"("createdByUserId");

-- CreateIndex
CREATE INDEX "CampaignLaunchRun_status_idx" ON "CampaignLaunchRun"("status");

-- CreateIndex
CREATE INDEX "CampaignLaunchRun_segmentId_idx" ON "CampaignLaunchRun"("segmentId");

-- CreateIndex
CREATE INDEX "CampaignLaunchRun_dryRunId_idx" ON "CampaignLaunchRun"("dryRunId");

-- CreateIndex
CREATE INDEX "CampaignLaunchRun_createdAt_idx" ON "CampaignLaunchRun"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignLaunchRun_companyId_campaignId_idempotencyKey_key" ON "CampaignLaunchRun"("companyId", "campaignId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "CampaignLaunchRecipient_companyId_idx" ON "CampaignLaunchRecipient"("companyId");

-- CreateIndex
CREATE INDEX "CampaignLaunchRecipient_launchRunId_idx" ON "CampaignLaunchRecipient"("launchRunId");

-- CreateIndex
CREATE INDEX "CampaignLaunchRecipient_campaignId_idx" ON "CampaignLaunchRecipient"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignLaunchRecipient_contactId_idx" ON "CampaignLaunchRecipient"("contactId");

-- CreateIndex
CREATE INDEX "CampaignLaunchRecipient_messageId_idx" ON "CampaignLaunchRecipient"("messageId");

-- CreateIndex
CREATE INDEX "CampaignLaunchRecipient_status_idx" ON "CampaignLaunchRecipient"("status");

-- CreateIndex
CREATE INDEX "CampaignLaunchRecipient_createdAt_idx" ON "CampaignLaunchRecipient"("createdAt");

-- CreateIndex
CREATE INDEX "CampaignWalletReservation_companyId_idx" ON "CampaignWalletReservation"("companyId");

-- CreateIndex
CREATE INDEX "CampaignWalletReservation_launchRunId_idx" ON "CampaignWalletReservation"("launchRunId");

-- CreateIndex
CREATE INDEX "CampaignWalletReservation_campaignId_idx" ON "CampaignWalletReservation"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignWalletReservation_status_idx" ON "CampaignWalletReservation"("status");

-- CreateIndex
CREATE INDEX "CampaignWalletReservation_createdAt_idx" ON "CampaignWalletReservation"("createdAt");

-- AddForeignKey
ALTER TABLE "CampaignLaunchRun" ADD CONSTRAINT "CampaignLaunchRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignLaunchRun" ADD CONSTRAINT "CampaignLaunchRun_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignLaunchRecipient" ADD CONSTRAINT "CampaignLaunchRecipient_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignLaunchRecipient" ADD CONSTRAINT "CampaignLaunchRecipient_launchRunId_fkey" FOREIGN KEY ("launchRunId") REFERENCES "CampaignLaunchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignWalletReservation" ADD CONSTRAINT "CampaignWalletReservation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignWalletReservation" ADD CONSTRAINT "CampaignWalletReservation_launchRunId_fkey" FOREIGN KEY ("launchRunId") REFERENCES "CampaignLaunchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
