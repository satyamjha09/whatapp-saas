-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "inboxSlaBreachedAt" TIMESTAMP(3),
ADD COLUMN     "inboxSlaEscalationCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Contact_companyId_inboxSlaBreachedAt_idx" ON "Contact"("companyId", "inboxSlaBreachedAt");

-- CreateIndex
CREATE INDEX "Contact_companyId_inboxStatus_inboxSlaDueAt_inboxSlaBreache_idx" ON "Contact"("companyId", "inboxStatus", "inboxSlaDueAt", "inboxSlaBreachedAt");
