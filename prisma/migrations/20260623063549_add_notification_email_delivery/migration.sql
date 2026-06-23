-- CreateEnum
CREATE TYPE "CompanyNotificationEmailDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "CompanyNotificationPreference" ADD COLUMN     "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailMinimumSeverity" "CompanyNotificationSeverity" NOT NULL DEFAULT 'ERROR';

-- CreateTable
CREATE TABLE "CompanyNotificationEmailDelivery" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "CompanyNotificationEmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyNotificationEmailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyNotificationEmailDelivery_companyId_idx" ON "CompanyNotificationEmailDelivery"("companyId");

-- CreateIndex
CREATE INDEX "CompanyNotificationEmailDelivery_notificationId_idx" ON "CompanyNotificationEmailDelivery"("notificationId");

-- CreateIndex
CREATE INDEX "CompanyNotificationEmailDelivery_userId_idx" ON "CompanyNotificationEmailDelivery"("userId");

-- CreateIndex
CREATE INDEX "CompanyNotificationEmailDelivery_status_idx" ON "CompanyNotificationEmailDelivery"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyNotificationEmailDelivery_notificationId_userId_key" ON "CompanyNotificationEmailDelivery"("notificationId", "userId");

-- AddForeignKey
ALTER TABLE "CompanyNotificationEmailDelivery" ADD CONSTRAINT "CompanyNotificationEmailDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "CompanyNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyNotificationEmailDelivery" ADD CONSTRAINT "CompanyNotificationEmailDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
