-- CreateEnum
CREATE TYPE "WhatsAppFlowStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'DEPRECATED', 'DISABLED');

-- CreateEnum
CREATE TYPE "WhatsAppFlowUseCase" AS ENUM ('LEAD_CAPTURE', 'APPOINTMENT_BOOKING', 'FEEDBACK_SURVEY', 'PAYMENT_COLLECTION', 'CUSTOMER_SUPPORT', 'KYC', 'ORDER_ENQUIRY', 'CUSTOM');

-- CreateTable
CREATE TABLE "WhatsAppFlow" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "useCase" "WhatsAppFlowUseCase" NOT NULL DEFAULT 'CUSTOM',
    "metaFlowId" TEXT NOT NULL,
    "status" "WhatsAppFlowStatus" NOT NULL DEFAULT 'DRAFT',
    "defaultCta" TEXT NOT NULL DEFAULT 'Open form',
    "defaultScreen" TEXT,
    "dataApiEndpoint" TEXT,
    "schema" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppFlowResponse" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "contactId" TEXT,
    "messageId" TEXT,
    "campaignId" TEXT,
    "flowToken" TEXT NOT NULL,
    "responsePayload" JSONB NOT NULL,
    "rawWebhook" JSONB,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppFlowResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppFlow_companyId_metaFlowId_key" ON "WhatsAppFlow"("companyId", "metaFlowId");

-- CreateIndex
CREATE INDEX "WhatsAppFlow_companyId_idx" ON "WhatsAppFlow"("companyId");

-- CreateIndex
CREATE INDEX "WhatsAppFlow_status_idx" ON "WhatsAppFlow"("status");

-- CreateIndex
CREATE INDEX "WhatsAppFlow_useCase_idx" ON "WhatsAppFlow"("useCase");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppFlowResponse_flowToken_key" ON "WhatsAppFlowResponse"("flowToken");

-- CreateIndex
CREATE INDEX "WhatsAppFlowResponse_companyId_idx" ON "WhatsAppFlowResponse"("companyId");

-- CreateIndex
CREATE INDEX "WhatsAppFlowResponse_flowId_idx" ON "WhatsAppFlowResponse"("flowId");

-- CreateIndex
CREATE INDEX "WhatsAppFlowResponse_contactId_idx" ON "WhatsAppFlowResponse"("contactId");

-- CreateIndex
CREATE INDEX "WhatsAppFlowResponse_messageId_idx" ON "WhatsAppFlowResponse"("messageId");

-- CreateIndex
CREATE INDEX "WhatsAppFlowResponse_campaignId_idx" ON "WhatsAppFlowResponse"("campaignId");

-- CreateIndex
CREATE INDEX "WhatsAppFlowResponse_submittedAt_idx" ON "WhatsAppFlowResponse"("submittedAt");

-- AddForeignKey
ALTER TABLE "WhatsAppFlow" ADD CONSTRAINT "WhatsAppFlow_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppFlowResponse" ADD CONSTRAINT "WhatsAppFlowResponse_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "WhatsAppFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppFlowResponse" ADD CONSTRAINT "WhatsAppFlowResponse_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppFlowResponse" ADD CONSTRAINT "WhatsAppFlowResponse_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppFlowResponse" ADD CONSTRAINT "WhatsAppFlowResponse_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppFlowResponse" ADD CONSTRAINT "WhatsAppFlowResponse_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
