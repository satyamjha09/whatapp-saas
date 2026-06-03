-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('CREDIT', 'DEBIT', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "WalletTransactionStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "balancePaise" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "status" "WalletTransactionStatus" NOT NULL DEFAULT 'SUCCESS',
    "amountPaise" INTEGER NOT NULL,
    "description" TEXT,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_companyId_key" ON "Wallet"("companyId");

-- CreateIndex
CREATE INDEX "WalletTransaction_companyId_idx" ON "WalletTransaction"("companyId");

-- CreateIndex
CREATE INDEX "WalletTransaction_type_idx" ON "WalletTransaction"("type");

-- CreateIndex
CREATE INDEX "WalletTransaction_status_idx" ON "WalletTransaction"("status");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
