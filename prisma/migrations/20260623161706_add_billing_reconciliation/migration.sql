-- CreateEnum
CREATE TYPE "MessageUsageLedgerStatus" AS ENUM ('CHARGED');

-- CreateEnum
CREATE TYPE "BillingReconciliationRunStatus" AS ENUM ('RUNNING', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "BillingReconciliationIssueType" AS ENUM ('WALLET_BALANCE_MISMATCH', 'MISSING_WALLET_TRANSACTION', 'WALLET_TRANSACTION_AMOUNT_MISMATCH', 'DUPLICATE_MESSAGE_CHARGE', 'ORPHAN_USAGE_LEDGER', 'ORPHAN_WALLET_TRANSACTION');

-- CreateEnum
CREATE TYPE "BillingReconciliationIssueSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "MessageUsageLedger" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "messageId" TEXT,
    "walletTransactionId" TEXT,
    "status" "MessageUsageLedgerStatus" NOT NULL DEFAULT 'CHARGED',
    "amountPaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageUsageLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingReconciliationRun" (
    "id" TEXT NOT NULL,
    "status" "BillingReconciliationRunStatus" NOT NULL DEFAULT 'RUNNING',
    "checkedCompanies" INTEGER NOT NULL DEFAULT 0,
    "checkedLedgers" INTEGER NOT NULL DEFAULT 0,
    "issueCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingReconciliationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingReconciliationIssue" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "companyId" TEXT,
    "type" "BillingReconciliationIssueType" NOT NULL,
    "severity" "BillingReconciliationIssueSeverity" NOT NULL DEFAULT 'HIGH',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "messageUsageLedgerId" TEXT,
    "walletTransactionId" TEXT,
    "walletId" TEXT,
    "expectedAmountPaise" INTEGER,
    "actualAmountPaise" INTEGER,
    "metadata" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingReconciliationIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageUsageLedger_companyId_idx" ON "MessageUsageLedger"("companyId");

-- CreateIndex
CREATE INDEX "MessageUsageLedger_messageId_idx" ON "MessageUsageLedger"("messageId");

-- CreateIndex
CREATE INDEX "MessageUsageLedger_walletTransactionId_idx" ON "MessageUsageLedger"("walletTransactionId");

-- CreateIndex
CREATE INDEX "MessageUsageLedger_status_idx" ON "MessageUsageLedger"("status");

-- CreateIndex
CREATE INDEX "MessageUsageLedger_createdAt_idx" ON "MessageUsageLedger"("createdAt");

-- CreateIndex
CREATE INDEX "BillingReconciliationRun_status_idx" ON "BillingReconciliationRun"("status");

-- CreateIndex
CREATE INDEX "BillingReconciliationRun_startedAt_idx" ON "BillingReconciliationRun"("startedAt");

-- CreateIndex
CREATE INDEX "BillingReconciliationIssue_runId_idx" ON "BillingReconciliationIssue"("runId");

-- CreateIndex
CREATE INDEX "BillingReconciliationIssue_companyId_idx" ON "BillingReconciliationIssue"("companyId");

-- CreateIndex
CREATE INDEX "BillingReconciliationIssue_type_idx" ON "BillingReconciliationIssue"("type");

-- CreateIndex
CREATE INDEX "BillingReconciliationIssue_severity_idx" ON "BillingReconciliationIssue"("severity");

-- CreateIndex
CREATE INDEX "BillingReconciliationIssue_resolvedAt_idx" ON "BillingReconciliationIssue"("resolvedAt");

-- CreateIndex
CREATE INDEX "BillingReconciliationIssue_createdAt_idx" ON "BillingReconciliationIssue"("createdAt");

-- AddForeignKey
ALTER TABLE "MessageUsageLedger" ADD CONSTRAINT "MessageUsageLedger_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageUsageLedger" ADD CONSTRAINT "MessageUsageLedger_walletTransactionId_fkey" FOREIGN KEY ("walletTransactionId") REFERENCES "WalletTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingReconciliationIssue" ADD CONSTRAINT "BillingReconciliationIssue_runId_fkey" FOREIGN KEY ("runId") REFERENCES "BillingReconciliationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Normalize and backfill historical per-message debits so the first
-- reconciliation run starts from the existing billing history.
UPDATE "WalletTransaction" AS tx
SET "referenceType" = 'MESSAGE_USAGE'
WHERE tx."type" = 'DEBIT'
  AND tx."status" IN ('SUCCESS', 'COMPLETED')
  AND tx."referenceId" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "Message" AS message
    WHERE message."id" = tx."referenceId"
      AND message."companyId" = tx."companyId"
  );

UPDATE "WalletTransaction" AS tx
SET "referenceType" = 'BULK_MESSAGE_USAGE'
WHERE tx."type" = 'DEBIT'
  AND tx."status" IN ('SUCCESS', 'COMPLETED')
  AND tx."referenceId" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "BulkMessageBatch" AS batch
    WHERE batch."id" = tx."referenceId"
      AND batch."companyId" = tx."companyId"
  );

INSERT INTO "MessageUsageLedger" (
  "id",
  "companyId",
  "messageId",
  "walletTransactionId",
  "status",
  "amountPaise",
  "createdAt",
  "updatedAt"
)
SELECT
  'usage_' || md5(tx."id" || ':' || message."id"),
  tx."companyId",
  message."id",
  tx."id",
  'CHARGED'::"MessageUsageLedgerStatus",
  100,
  tx."createdAt",
  CURRENT_TIMESTAMP
FROM "WalletTransaction" AS tx
JOIN "Message" AS message
  ON message."id" = tx."referenceId"
 AND message."companyId" = tx."companyId"
WHERE tx."referenceType" = 'MESSAGE_USAGE'
  AND tx."type" = 'DEBIT'
  AND tx."status" IN ('SUCCESS', 'COMPLETED');

INSERT INTO "MessageUsageLedger" (
  "id",
  "companyId",
  "messageId",
  "walletTransactionId",
  "status",
  "amountPaise",
  "createdAt",
  "updatedAt"
)
SELECT
  'usage_' || md5(tx."id" || ':' || recipient."messageId"),
  tx."companyId",
  recipient."messageId",
  tx."id",
  'CHARGED'::"MessageUsageLedgerStatus",
  100,
  tx."createdAt",
  CURRENT_TIMESTAMP
FROM "WalletTransaction" AS tx
JOIN "BulkMessageBatch" AS batch
  ON batch."id" = tx."referenceId"
 AND batch."companyId" = tx."companyId"
JOIN "BulkMessageBatchRecipient" AS recipient
  ON recipient."batchId" = batch."id"
 AND recipient."messageId" IS NOT NULL
WHERE tx."referenceType" = 'BULK_MESSAGE_USAGE'
  AND tx."type" = 'DEBIT'
  AND tx."status" IN ('SUCCESS', 'COMPLETED');
