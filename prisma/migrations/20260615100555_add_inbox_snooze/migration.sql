-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "snoozedUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Contact_companyId_snoozedUntil_idx" ON "Contact"("companyId", "snoozedUntil");
