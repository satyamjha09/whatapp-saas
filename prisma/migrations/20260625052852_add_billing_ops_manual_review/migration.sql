-- CreateEnum
CREATE TYPE "BillingOpsReviewDecision" AS ENUM ('APPROVED', 'REJECTED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "PlanCheckoutStatus" ADD VALUE 'MANUAL_REVIEW';

-- AlterTable
ALTER TABLE "PlanCheckout" ADD COLUMN     "manualReviewDecision" "BillingOpsReviewDecision",
ADD COLUMN     "manualReviewNotes" TEXT,
ADD COLUMN     "manualReviewOpenedAt" TIMESTAMP(3),
ADD COLUMN     "manualReviewReason" TEXT,
ADD COLUMN     "manualReviewedAt" TIMESTAMP(3),
ADD COLUMN     "manualReviewedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "PlanCheckout_manualReviewOpenedAt_idx" ON "PlanCheckout"("manualReviewOpenedAt");

-- CreateIndex
CREATE INDEX "PlanCheckout_manualReviewedAt_idx" ON "PlanCheckout"("manualReviewedAt");

-- CreateIndex
CREATE INDEX "PlanCheckout_manualReviewedByUserId_idx" ON "PlanCheckout"("manualReviewedByUserId");

-- CreateIndex
CREATE INDEX "PlanCheckout_manualReviewDecision_idx" ON "PlanCheckout"("manualReviewDecision");

-- AddForeignKey
ALTER TABLE "PlanCheckout" ADD CONSTRAINT "PlanCheckout_manualReviewedByUserId_fkey" FOREIGN KEY ("manualReviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
