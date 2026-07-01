-- AlterTable
ALTER TABLE "WhatsAppPhoneNumber"
  ADD COLUMN "messagingLimitTier" TEXT,
  ADD COLUMN "numberType" TEXT,
  ADD COLUMN "codeVerificationStatus" TEXT,
  ADD COLUMN "nameStatus" TEXT,
  ADD COLUMN "platformType" TEXT,
  ADD COLUMN "throughput" JSONB,
  ADD COLUMN "healthStatus" JSONB,
  ADD COLUMN "canSendMessage" TEXT,
  ADD COLUMN "lastStatusCheckAt" TIMESTAMP(3),
  ADD COLUMN "lastStatusError" TEXT;

-- CreateTable
CREATE TABLE "WhatsAppEmbeddedSignupEvent" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT,
  "whatsAppAccountId" TEXT,
  "flowSessionId" TEXT,
  "eventType" TEXT NOT NULL,
  "currentStep" TEXT,
  "wabaId" TEXT,
  "phoneNumberId" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WhatsAppEmbeddedSignupEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsAppPhoneNumber_canSendMessage_idx" ON "WhatsAppPhoneNumber"("canSendMessage");
CREATE INDEX "WhatsAppPhoneNumber_lastStatusCheckAt_idx" ON "WhatsAppPhoneNumber"("lastStatusCheckAt");
CREATE INDEX "WhatsAppEmbeddedSignupEvent_companyId_idx" ON "WhatsAppEmbeddedSignupEvent"("companyId");
CREATE INDEX "WhatsAppEmbeddedSignupEvent_userId_idx" ON "WhatsAppEmbeddedSignupEvent"("userId");
CREATE INDEX "WhatsAppEmbeddedSignupEvent_whatsAppAccountId_idx" ON "WhatsAppEmbeddedSignupEvent"("whatsAppAccountId");
CREATE INDEX "WhatsAppEmbeddedSignupEvent_flowSessionId_idx" ON "WhatsAppEmbeddedSignupEvent"("flowSessionId");
CREATE INDEX "WhatsAppEmbeddedSignupEvent_eventType_idx" ON "WhatsAppEmbeddedSignupEvent"("eventType");
CREATE INDEX "WhatsAppEmbeddedSignupEvent_wabaId_idx" ON "WhatsAppEmbeddedSignupEvent"("wabaId");
CREATE INDEX "WhatsAppEmbeddedSignupEvent_phoneNumberId_idx" ON "WhatsAppEmbeddedSignupEvent"("phoneNumberId");
CREATE INDEX "WhatsAppEmbeddedSignupEvent_createdAt_idx" ON "WhatsAppEmbeddedSignupEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "WhatsAppEmbeddedSignupEvent" ADD CONSTRAINT "WhatsAppEmbeddedSignupEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhatsAppEmbeddedSignupEvent" ADD CONSTRAINT "WhatsAppEmbeddedSignupEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WhatsAppEmbeddedSignupEvent" ADD CONSTRAINT "WhatsAppEmbeddedSignupEvent_whatsAppAccountId_fkey" FOREIGN KEY ("whatsAppAccountId") REFERENCES "WhatsAppAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
