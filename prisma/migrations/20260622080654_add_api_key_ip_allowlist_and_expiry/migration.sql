-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "allowedIps" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "ApiKey_expiresAt_idx" ON "ApiKey"("expiresAt");
