-- CreateTable
CREATE TABLE "CompanyNotificationRecipient" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "CompanyNotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "readAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyNotificationRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyNotificationRecipient_notificationId_idx" ON "CompanyNotificationRecipient"("notificationId");

-- CreateIndex
CREATE INDEX "CompanyNotificationRecipient_userId_idx" ON "CompanyNotificationRecipient"("userId");

-- CreateIndex
CREATE INDEX "CompanyNotificationRecipient_userId_status_idx" ON "CompanyNotificationRecipient"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyNotificationRecipient_notificationId_userId_key" ON "CompanyNotificationRecipient"("notificationId", "userId");

-- AddForeignKey
ALTER TABLE "CompanyNotificationRecipient" ADD CONSTRAINT "CompanyNotificationRecipient_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "CompanyNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyNotificationRecipient" ADD CONSTRAINT "CompanyNotificationRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
