-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "metaBusinessVerificationStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN     "metaPaymentMethodAdded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "productionChecklistNotes" TEXT,
ADD COLUMN     "productionChecklistUpdatedAt" TIMESTAMP(3);
