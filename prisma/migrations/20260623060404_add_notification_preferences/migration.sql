-- CreateTable
CREATE TABLE "CompanyNotificationPreference" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CompanyNotificationType" NOT NULL,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "minimumSeverity" "CompanyNotificationSeverity" NOT NULL DEFAULT 'INFO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyNotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyNotificationPreference_companyId_idx" ON "CompanyNotificationPreference"("companyId");

-- CreateIndex
CREATE INDEX "CompanyNotificationPreference_userId_idx" ON "CompanyNotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyNotificationPreference_companyId_userId_type_key" ON "CompanyNotificationPreference"("companyId", "userId", "type");

-- AddForeignKey
ALTER TABLE "CompanyNotificationPreference" ADD CONSTRAINT "CompanyNotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
