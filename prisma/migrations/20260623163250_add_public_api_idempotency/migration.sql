-- CreateEnum
CREATE TYPE "PublicApiIdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "PublicApiIdempotencyRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "apiKeyId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" "PublicApiIdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "lockedUntil" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicApiIdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicApiIdempotencyRecord_companyId_idx" ON "PublicApiIdempotencyRecord"("companyId");

-- CreateIndex
CREATE INDEX "PublicApiIdempotencyRecord_apiKeyId_idx" ON "PublicApiIdempotencyRecord"("apiKeyId");

-- CreateIndex
CREATE INDEX "PublicApiIdempotencyRecord_status_idx" ON "PublicApiIdempotencyRecord"("status");

-- CreateIndex
CREATE INDEX "PublicApiIdempotencyRecord_expiresAt_idx" ON "PublicApiIdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE INDEX "PublicApiIdempotencyRecord_createdAt_idx" ON "PublicApiIdempotencyRecord"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PublicApiIdempotencyRecord_companyId_idempotencyKey_key" ON "PublicApiIdempotencyRecord"("companyId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "PublicApiIdempotencyRecord" ADD CONSTRAINT "PublicApiIdempotencyRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicApiIdempotencyRecord" ADD CONSTRAINT "PublicApiIdempotencyRecord_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;
