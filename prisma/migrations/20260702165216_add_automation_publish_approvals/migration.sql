-- CreateEnum
CREATE TYPE "AutomationPublishRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'SUPERSEDED');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "automationPublishApprovalRequired" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AutomationPublishRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "status" "AutomationPublishRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedByUserId" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "draftGraph" JSONB NOT NULL,
    "validationSnapshot" JSONB,
    "publishNotes" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationPublishRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationPublishRequest_companyId_idx" ON "AutomationPublishRequest"("companyId");

-- CreateIndex
CREATE INDEX "AutomationPublishRequest_companyId_flowId_idx" ON "AutomationPublishRequest"("companyId", "flowId");

-- CreateIndex
CREATE INDEX "AutomationPublishRequest_companyId_status_idx" ON "AutomationPublishRequest"("companyId", "status");

-- CreateIndex
CREATE INDEX "AutomationPublishRequest_requestedByUserId_idx" ON "AutomationPublishRequest"("requestedByUserId");

-- AddForeignKey
ALTER TABLE "AutomationPublishRequest" ADD CONSTRAINT "AutomationPublishRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationPublishRequest" ADD CONSTRAINT "AutomationPublishRequest_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "AutomationFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
