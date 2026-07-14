-- CreateTable
CREATE TABLE "BroadcastCampaignDraft" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "draftData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BroadcastCampaignDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BroadcastCampaignDraft_companyId_idx" ON "BroadcastCampaignDraft"("companyId");

-- CreateIndex
CREATE INDEX "BroadcastCampaignDraft_createdByUserId_idx" ON "BroadcastCampaignDraft"("createdByUserId");

-- CreateIndex
CREATE INDEX "BroadcastCampaignDraft_status_idx" ON "BroadcastCampaignDraft"("status");

-- CreateIndex
CREATE INDEX "BroadcastCampaignDraft_updatedAt_idx" ON "BroadcastCampaignDraft"("updatedAt");

-- AddForeignKey
ALTER TABLE "BroadcastCampaignDraft" ADD CONSTRAINT "BroadcastCampaignDraft_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
