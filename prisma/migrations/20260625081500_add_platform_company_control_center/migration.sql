-- CreateEnum
CREATE TYPE "PlatformCompanyActionType" AS ENUM ('VIEWED', 'APPROVED', 'ACTIVATED', 'SUSPENDED', 'REACTIVATED', 'DISABLED', 'NOTE_ADDED', 'NOTE_UPDATED');

-- CreateEnum
CREATE TYPE "PlatformCompanyNoteVisibility" AS ENUM ('INTERNAL', 'SUPPORT', 'FINANCE');

-- CreateTable
CREATE TABLE "PlatformCompanyActionLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "type" "PlatformCompanyActionType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformCompanyActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformCompanyNote" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "visibility" "PlatformCompanyNoteVisibility" NOT NULL DEFAULT 'INTERNAL',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformCompanyNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformCompanyActionLog_companyId_idx" ON "PlatformCompanyActionLog"("companyId");

-- CreateIndex
CREATE INDEX "PlatformCompanyActionLog_actorUserId_idx" ON "PlatformCompanyActionLog"("actorUserId");

-- CreateIndex
CREATE INDEX "PlatformCompanyActionLog_type_idx" ON "PlatformCompanyActionLog"("type");

-- CreateIndex
CREATE INDEX "PlatformCompanyActionLog_createdAt_idx" ON "PlatformCompanyActionLog"("createdAt");

-- CreateIndex
CREATE INDEX "PlatformCompanyNote_companyId_idx" ON "PlatformCompanyNote"("companyId");

-- CreateIndex
CREATE INDEX "PlatformCompanyNote_createdByUserId_idx" ON "PlatformCompanyNote"("createdByUserId");

-- CreateIndex
CREATE INDEX "PlatformCompanyNote_visibility_idx" ON "PlatformCompanyNote"("visibility");

-- CreateIndex
CREATE INDEX "PlatformCompanyNote_createdAt_idx" ON "PlatformCompanyNote"("createdAt");

-- AddForeignKey
ALTER TABLE "PlatformCompanyActionLog" ADD CONSTRAINT "PlatformCompanyActionLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformCompanyActionLog" ADD CONSTRAINT "PlatformCompanyActionLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformCompanyNote" ADD CONSTRAINT "PlatformCompanyNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformCompanyNote" ADD CONSTRAINT "PlatformCompanyNote_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
