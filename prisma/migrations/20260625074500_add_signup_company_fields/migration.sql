-- AlterTable
ALTER TABLE "User" ADD COLUMN "mobile" TEXT;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN "businessCategory" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "pinCode" TEXT,
ADD COLUMN "employeeCode" TEXT,
ADD COLUMN "whatsappUpdatesConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "whatsappUpdatesConsentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UserWorkspacePreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activeCompanyId" TEXT,
    "lastSelectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserWorkspacePreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserWorkspacePreference_userId_key" ON "UserWorkspacePreference"("userId");

-- CreateIndex
CREATE INDEX "UserWorkspacePreference_activeCompanyId_idx" ON "UserWorkspacePreference"("activeCompanyId");

-- CreateIndex
CREATE INDEX "UserWorkspacePreference_lastSelectedAt_idx" ON "UserWorkspacePreference"("lastSelectedAt");

-- AddForeignKey
ALTER TABLE "UserWorkspacePreference" ADD CONSTRAINT "UserWorkspacePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWorkspacePreference" ADD CONSTRAINT "UserWorkspacePreference_activeCompanyId_fkey" FOREIGN KEY ("activeCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
