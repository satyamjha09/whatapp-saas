-- CreateEnum
CREATE TYPE "CampaignCompletionReportStatus" AS ENUM ('GENERATED', 'FAILED');

-- CreateEnum
CREATE TYPE "CampaignCompletionTrigger" AS ENUM ('MANUAL', 'AUTO');

-- CreateEnum
CREATE TYPE "CampaignReportExportFormat" AS ENUM ('CSV', 'JSON');

-- CreateTable
CREATE TABLE "CampaignCompletionReport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "generatedByUserId" TEXT,
    "status" "CampaignCompletionReportStatus" NOT NULL DEFAULT 'GENERATED',
    "trigger" "CampaignCompletionTrigger" NOT NULL DEFAULT 'MANUAL',
    "totalMessages" INTEGER NOT NULL DEFAULT 0,
    "queuedMessages" INTEGER NOT NULL DEFAULT 0,
    "sendingMessages" INTEGER NOT NULL DEFAULT 0,
    "sentMessages" INTEGER NOT NULL DEFAULT 0,
    "deliveredMessages" INTEGER NOT NULL DEFAULT 0,
    "readMessages" INTEGER NOT NULL DEFAULT 0,
    "failedMessages" INTEGER NOT NULL DEFAULT 0,
    "canceledMessages" INTEGER NOT NULL DEFAULT 0,
    "deliveryRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "readRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "failureRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "estimatedCostPaise" INTEGER NOT NULL DEFAULT 0,
    "actualCostPaise" INTEGER NOT NULL DEFAULT 0,
    "walletReservedPaise" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "optOutCount" INTEGER NOT NULL DEFAULT 0,
    "failureInsightCount" INTEGER NOT NULL DEFAULT 0,
    "criticalFailureCount" INTEGER NOT NULL DEFAULT 0,
    "safeRetryFailureGroups" INTEGER NOT NULL DEFAULT 0,
    "campaignStartedAt" TIMESTAMP(3),
    "campaignCompletedAt" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failureReason" TEXT,
    "summary" JSONB,
    "failureBreakdown" JSONB,
    "statusBreakdown" JSONB,
    "costBreakdown" JSONB,
    "replyBreakdown" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignCompletionReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignReportExport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "format" "CampaignReportExportFormat" NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "generatedByUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignReportExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignCompletionReport_companyId_idx" ON "CampaignCompletionReport"("companyId");

-- CreateIndex
CREATE INDEX "CampaignCompletionReport_campaignId_idx" ON "CampaignCompletionReport"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignCompletionReport_generatedByUserId_idx" ON "CampaignCompletionReport"("generatedByUserId");

-- CreateIndex
CREATE INDEX "CampaignCompletionReport_status_idx" ON "CampaignCompletionReport"("status");

-- CreateIndex
CREATE INDEX "CampaignCompletionReport_trigger_idx" ON "CampaignCompletionReport"("trigger");

-- CreateIndex
CREATE INDEX "CampaignCompletionReport_generatedAt_idx" ON "CampaignCompletionReport"("generatedAt");

-- CreateIndex
CREATE INDEX "CampaignCompletionReport_createdAt_idx" ON "CampaignCompletionReport"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignCompletionReport_companyId_campaignId_key" ON "CampaignCompletionReport"("companyId", "campaignId");

-- CreateIndex
CREATE INDEX "CampaignReportExport_companyId_idx" ON "CampaignReportExport"("companyId");

-- CreateIndex
CREATE INDEX "CampaignReportExport_reportId_idx" ON "CampaignReportExport"("reportId");

-- CreateIndex
CREATE INDEX "CampaignReportExport_campaignId_idx" ON "CampaignReportExport"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignReportExport_format_idx" ON "CampaignReportExport"("format");

-- CreateIndex
CREATE INDEX "CampaignReportExport_generatedByUserId_idx" ON "CampaignReportExport"("generatedByUserId");

-- CreateIndex
CREATE INDEX "CampaignReportExport_createdAt_idx" ON "CampaignReportExport"("createdAt");

-- AddForeignKey
ALTER TABLE "CampaignCompletionReport" ADD CONSTRAINT "CampaignCompletionReport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignCompletionReport" ADD CONSTRAINT "CampaignCompletionReport_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignCompletionReport" ADD CONSTRAINT "CampaignCompletionReport_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignReportExport" ADD CONSTRAINT "CampaignReportExport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignReportExport" ADD CONSTRAINT "CampaignReportExport_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignReportExport" ADD CONSTRAINT "CampaignReportExport_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "CampaignCompletionReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignReportExport" ADD CONSTRAINT "CampaignReportExport_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
