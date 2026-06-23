-- CreateEnum
CREATE TYPE "CompanyNotificationType" AS ENUM ('BILLING', 'WALLET', 'WEBHOOK', 'DEVELOPER_API', 'CAMPAIGN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CompanyNotificationSeverity" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "CompanyNotificationStatus" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');

-- CreateTable
CREATE TABLE "CompanyNotification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "CompanyNotificationType" NOT NULL,
    "severity" "CompanyNotificationSeverity" NOT NULL DEFAULT 'INFO',
    "status" "CompanyNotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actionHref" TEXT,
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyNotification_companyId_idx" ON "CompanyNotification"("companyId");

-- CreateIndex
CREATE INDEX "CompanyNotification_companyId_status_idx" ON "CompanyNotification"("companyId", "status");

-- CreateIndex
CREATE INDEX "CompanyNotification_companyId_type_idx" ON "CompanyNotification"("companyId", "type");

-- CreateIndex
CREATE INDEX "CompanyNotification_createdAt_idx" ON "CompanyNotification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyNotification_companyId_idempotencyKey_key" ON "CompanyNotification"("companyId", "idempotencyKey");
