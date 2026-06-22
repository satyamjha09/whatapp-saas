-- CreateEnum
CREATE TYPE "DeveloperApiRequestLogStatus" AS ENUM ('SUCCESS', 'FAILED', 'BLOCKED', 'RATE_LIMITED');

-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "revokedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DeveloperApiRequestLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "apiKeyId" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status" "DeveloperApiRequestLogStatus" NOT NULL,
    "statusCode" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeveloperApiRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeveloperApiRequestLog_companyId_idx" ON "DeveloperApiRequestLog"("companyId");

-- CreateIndex
CREATE INDEX "DeveloperApiRequestLog_apiKeyId_idx" ON "DeveloperApiRequestLog"("apiKeyId");

-- CreateIndex
CREATE INDEX "DeveloperApiRequestLog_status_idx" ON "DeveloperApiRequestLog"("status");

-- CreateIndex
CREATE INDEX "DeveloperApiRequestLog_createdAt_idx" ON "DeveloperApiRequestLog"("createdAt");

-- CreateIndex
CREATE INDEX "ApiKey_revokedAt_idx" ON "ApiKey"("revokedAt");

-- AddForeignKey
ALTER TABLE "DeveloperApiRequestLog" ADD CONSTRAINT "DeveloperApiRequestLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeveloperApiRequestLog" ADD CONSTRAINT "DeveloperApiRequestLog_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;
