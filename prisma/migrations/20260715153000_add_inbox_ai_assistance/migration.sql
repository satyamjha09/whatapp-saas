-- AlterEnum
ALTER TYPE "RbacPermission" ADD VALUE IF NOT EXISTS 'INBOX_USE_AI';

-- CreateTable
CREATE TABLE "InboxConversationSummary" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "language" TEXT,
    "latencyMs" INTEGER,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "errorMessage" TEXT,
    "staleAt" TIMESTAMP(3),
    "staleReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxConversationSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxAiSuggestion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "tone" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "language" TEXT,
    "latencyMs" INTEGER,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxAiSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxMessageTranslation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "sourceLanguage" TEXT,
    "targetLanguage" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "originalText" TEXT NOT NULL,
    "translatedText" TEXT NOT NULL,
    "latencyMs" INTEGER,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxMessageTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InboxConversationSummary_companyId_contactId_idx" ON "InboxConversationSummary"("companyId", "contactId");
CREATE INDEX "InboxConversationSummary_companyId_contactId_createdAt_idx" ON "InboxConversationSummary"("companyId", "contactId", "createdAt");
CREATE INDEX "InboxConversationSummary_companyId_contactId_staleAt_idx" ON "InboxConversationSummary"("companyId", "contactId", "staleAt");
CREATE INDEX "InboxConversationSummary_inputHash_idx" ON "InboxConversationSummary"("inputHash");

-- CreateIndex
CREATE INDEX "InboxAiSuggestion_companyId_contactId_idx" ON "InboxAiSuggestion"("companyId", "contactId");
CREATE INDEX "InboxAiSuggestion_companyId_contactId_createdAt_idx" ON "InboxAiSuggestion"("companyId", "contactId", "createdAt");
CREATE INDEX "InboxAiSuggestion_requestedByUserId_idx" ON "InboxAiSuggestion"("requestedByUserId");
CREATE INDEX "InboxAiSuggestion_inputHash_idx" ON "InboxAiSuggestion"("inputHash");

-- CreateIndex
CREATE UNIQUE INDEX "InboxMessageTranslation_companyId_messageId_targetLanguage_key" ON "InboxMessageTranslation"("companyId", "messageId", "targetLanguage");
CREATE INDEX "InboxMessageTranslation_companyId_messageId_idx" ON "InboxMessageTranslation"("companyId", "messageId");
CREATE INDEX "InboxMessageTranslation_requestedByUserId_idx" ON "InboxMessageTranslation"("requestedByUserId");
CREATE INDEX "InboxMessageTranslation_inputHash_idx" ON "InboxMessageTranslation"("inputHash");

-- AddForeignKey
ALTER TABLE "InboxConversationSummary" ADD CONSTRAINT "InboxConversationSummary_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboxConversationSummary" ADD CONSTRAINT "InboxConversationSummary_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxAiSuggestion" ADD CONSTRAINT "InboxAiSuggestion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboxAiSuggestion" ADD CONSTRAINT "InboxAiSuggestion_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxMessageTranslation" ADD CONSTRAINT "InboxMessageTranslation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboxMessageTranslation" ADD CONSTRAINT "InboxMessageTranslation_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
