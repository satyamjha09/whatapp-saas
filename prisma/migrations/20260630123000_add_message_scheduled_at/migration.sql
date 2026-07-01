-- AlterTable
ALTER TABLE "Message" ADD COLUMN "scheduledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Message_companyId_scheduledAt_idx" ON "Message"("companyId", "scheduledAt");
