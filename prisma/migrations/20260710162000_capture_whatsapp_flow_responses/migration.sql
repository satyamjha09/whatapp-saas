-- CreateEnum
CREATE TYPE "WhatsAppFlowResponseStatus" AS ENUM ('CAPTURED', 'FAILED');

-- AlterTable
ALTER TABLE "WhatsAppFlowResponse"
  ADD COLUMN "flowInteractionId" TEXT,
  ADD COLUMN "providerMessageId" TEXT,
  ADD COLUMN "flowTokenHash" TEXT,
  ADD COLUMN "responseData" JSONB,
  ADD COLUMN "screenId" TEXT,
  ADD COLUMN "status" "WhatsAppFlowResponseStatus" NOT NULL DEFAULT 'CAPTURED',
  ADD COLUMN "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "processedAt" TIMESTAMP(3),
  ADD COLUMN "processingError" TEXT,
  ALTER COLUMN "flowToken" DROP NOT NULL;

-- Backfill new responseData for legacy rows.
UPDATE "WhatsAppFlowResponse"
SET "responseData" = "responsePayload"
WHERE "responseData" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppFlowResponse_flowInteractionId_key" ON "WhatsAppFlowResponse"("flowInteractionId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppFlowResponse_flowTokenHash_key" ON "WhatsAppFlowResponse"("flowTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppFlowResponse_companyId_providerMessageId_key" ON "WhatsAppFlowResponse"("companyId", "providerMessageId");

-- CreateIndex
CREATE INDEX "WhatsAppFlowResponse_flowInteractionId_idx" ON "WhatsAppFlowResponse"("flowInteractionId");

-- CreateIndex
CREATE INDEX "WhatsAppFlowResponse_providerMessageId_idx" ON "WhatsAppFlowResponse"("providerMessageId");

-- CreateIndex
CREATE INDEX "WhatsAppFlowResponse_receivedAt_idx" ON "WhatsAppFlowResponse"("receivedAt");

-- CreateIndex
CREATE INDEX "WhatsAppFlowResponse_status_idx" ON "WhatsAppFlowResponse"("status");

-- AddForeignKey
ALTER TABLE "WhatsAppFlowResponse"
  ADD CONSTRAINT "WhatsAppFlowResponse_flowInteractionId_fkey"
  FOREIGN KEY ("flowInteractionId") REFERENCES "WhatsAppFlowInteraction"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
