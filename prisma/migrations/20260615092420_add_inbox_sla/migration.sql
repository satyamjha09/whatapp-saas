-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "inboxLastCustomerMessageAt" TIMESTAMP(3),
ADD COLUMN     "inboxSlaDueAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Contact_companyId_inboxSlaDueAt_idx" ON "Contact"("companyId", "inboxSlaDueAt");

-- CreateIndex
CREATE INDEX "Contact_companyId_inboxStatus_inboxSlaDueAt_idx" ON "Contact"("companyId", "inboxStatus", "inboxSlaDueAt");
