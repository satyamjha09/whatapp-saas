-- CreateEnum
CREATE TYPE "ProviderWebhookProvider" AS ENUM ('META', 'RAZORPAY');

-- CreateEnum
CREATE TYPE "ProviderWebhookEventStatus" AS ENUM ('PROCESSING', 'SUCCEEDED', 'FAILED', 'SKIPPED_DUPLICATE');

-- CreateTable
CREATE TABLE "ProviderWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "ProviderWebhookProvider" NOT NULL,
    "status" "ProviderWebhookEventStatus" NOT NULL DEFAULT 'PROCESSING',
    "providerEventId" TEXT,
    "eventType" TEXT,
    "bodySha256" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingStartedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "lastDuplicateSeenAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderWebhookEvent_provider_idx" ON "ProviderWebhookEvent"("provider");

-- CreateIndex
CREATE INDEX "ProviderWebhookEvent_status_idx" ON "ProviderWebhookEvent"("status");

-- CreateIndex
CREATE INDEX "ProviderWebhookEvent_receivedAt_idx" ON "ProviderWebhookEvent"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderWebhookEvent_provider_bodySha256_key" ON "ProviderWebhookEvent"("provider", "bodySha256");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderWebhookEvent_provider_providerEventId_key" ON "ProviderWebhookEvent"("provider", "providerEventId");
