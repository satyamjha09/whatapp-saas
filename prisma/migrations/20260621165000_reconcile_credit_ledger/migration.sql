-- Reconcile database changes that were applied before they were added to migration history.
CREATE TYPE "CreditPurchaseStatus" AS ENUM ('CREATED', 'PAID', 'FAILED');

ALTER TYPE "WalletTransactionStatus" ADD VALUE 'COMPLETED';
ALTER TYPE "WalletTransactionStatus" ADD VALUE 'REFUNDED';

ALTER TABLE "Contact"
ADD COLUMN "blockedAt" TIMESTAMP(3),
ADD COLUMN "optedOutAt" TIMESTAMP(3),
ADD COLUMN "optOutReason" TEXT,
ADD COLUMN "optOutSource" TEXT;

ALTER TABLE "WalletTransaction"
ADD COLUMN "balanceAfterPaise" INTEGER,
ADD COLUMN "referenceType" TEXT,
ADD COLUMN "createdByUserId" TEXT,
ADD COLUMN "reservedAt" TIMESTAMP(3),
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "refundedAt" TIMESTAMP(3),
ADD COLUMN "failedAt" TIMESTAMP(3);

CREATE TABLE "CreditPurchase" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "packId" TEXT NOT NULL,
  "credits" INTEGER NOT NULL,
  "amountPaise" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "razorpayOrderId" TEXT NOT NULL,
  "razorpayPaymentId" TEXT,
  "razorpaySignature" TEXT,
  "status" "CreditPurchaseStatus" NOT NULL DEFAULT 'CREATED',
  "paidAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreditPurchase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Contact_companyId_optedOutAt_idx" ON "Contact"("companyId", "optedOutAt");
CREATE INDEX "CreditPurchase_companyId_idx" ON "CreditPurchase"("companyId");
CREATE INDEX "CreditPurchase_userId_idx" ON "CreditPurchase"("userId");
CREATE INDEX "CreditPurchase_status_idx" ON "CreditPurchase"("status");
CREATE INDEX "CreditPurchase_createdAt_idx" ON "CreditPurchase"("createdAt");
CREATE UNIQUE INDEX "CreditPurchase_razorpayOrderId_key" ON "CreditPurchase"("razorpayOrderId");
CREATE UNIQUE INDEX "CreditPurchase_razorpayPaymentId_key" ON "CreditPurchase"("razorpayPaymentId");
CREATE INDEX "WalletTransaction_createdAt_idx" ON "WalletTransaction"("createdAt");
CREATE INDEX "WalletTransaction_status_reservedAt_idx" ON "WalletTransaction"("status", "reservedAt");
CREATE UNIQUE INDEX "WalletTransaction_companyId_referenceType_referenceId_type_key"
ON "WalletTransaction"("companyId", "referenceType", "referenceId", "type");

ALTER TABLE "CreditPurchase"
ADD CONSTRAINT "CreditPurchase_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
