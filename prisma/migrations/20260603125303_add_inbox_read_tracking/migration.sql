-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "inboxReadAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Message_companyId_direction_inboxReadAt_idx" ON "Message"("companyId", "direction", "inboxReadAt");
