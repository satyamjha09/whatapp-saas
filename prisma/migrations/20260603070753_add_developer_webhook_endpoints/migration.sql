-- CreateEnum
CREATE TYPE "DeveloperWebhookEndpointStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "DeveloperWebhookEndpoint" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "signingSecretEncrypted" TEXT NOT NULL,
    "secretPrefix" TEXT NOT NULL,
    "secretLast4" TEXT NOT NULL,
    "status" "DeveloperWebhookEndpointStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeveloperWebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeveloperWebhookEndpoint_companyId_idx" ON "DeveloperWebhookEndpoint"("companyId");

-- CreateIndex
CREATE INDEX "DeveloperWebhookEndpoint_status_idx" ON "DeveloperWebhookEndpoint"("status");

-- AddForeignKey
ALTER TABLE "DeveloperWebhookEndpoint" ADD CONSTRAINT "DeveloperWebhookEndpoint_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
