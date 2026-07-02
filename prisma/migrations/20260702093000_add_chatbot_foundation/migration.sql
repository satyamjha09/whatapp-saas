-- CreateEnum
CREATE TYPE "ChatbotStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ChatbotVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ChatbotNodeType" AS ENUM ('START', 'MESSAGE', 'QUICK_REPLY', 'LIST_MENU', 'QUESTION', 'CONDITION', 'API_CALL', 'ASSIGN_AGENT', 'END', 'CATALOG_PRODUCT_CARD', 'PAYMENT_LINK', 'TALLY_INVOICE_LOOKUP', 'TALLY_LEDGER_BALANCE', 'AI_REPLY', 'WHATSAPP_NATIVE_FLOW');

-- CreateEnum
CREATE TYPE "ChatbotTriggerType" AS ENUM ('KEYWORD', 'REGEX', 'TEMPLATE_MESSAGE', 'CLICK_TO_WHATSAPP_AD', 'DEFAULT_WELCOME', 'MANUAL');

-- CreateEnum
CREATE TYPE "ChatbotSessionStatus" AS ENUM ('ACTIVE', 'WAITING_FOR_REPLY', 'COMPLETED', 'ABANDONED', 'HANDED_OFF', 'FAILED');

-- CreateEnum
CREATE TYPE "ChatbotSessionEventType" AS ENUM ('SESSION_STARTED', 'TRIGGER_MATCHED', 'NODE_ENTERED', 'NODE_COMPLETED', 'MESSAGE_SENT', 'MESSAGE_RECEIVED', 'CONDITION_EVALUATED', 'API_CALL_STARTED', 'API_CALL_COMPLETED', 'ASSIGNED_AGENT', 'SESSION_COMPLETED', 'SESSION_FAILED');

-- CreateTable
CREATE TABLE "Chatbot" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ChatbotStatus" NOT NULL DEFAULT 'DRAFT',
    "activeVersionId" TEXT,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chatbot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatbotVersion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "ChatbotVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "label" TEXT,
    "canvas" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatbotVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatbotNode" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "nodeKey" TEXT NOT NULL,
    "type" "ChatbotNodeType" NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB,
    "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatbotNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatbotEdge" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "targetNodeId" TEXT NOT NULL,
    "label" TEXT,
    "condition" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatbotEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatbotTrigger" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "type" "ChatbotTriggerType" NOT NULL,
    "value" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatbotTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatbotSession" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "versionId" TEXT,
    "contactId" TEXT,
    "currentNodeId" TEXT,
    "triggerId" TEXT,
    "status" "ChatbotSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastInteractionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "handoffAt" TIMESTAMP(3),
    "context" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatbotSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatbotSessionEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "versionId" TEXT,
    "nodeId" TEXT,
    "messageId" TEXT,
    "eventType" "ChatbotSessionEventType" NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatbotSessionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Chatbot_activeVersionId_key" ON "Chatbot"("activeVersionId");

-- CreateIndex
CREATE INDEX "Chatbot_companyId_idx" ON "Chatbot"("companyId");

-- CreateIndex
CREATE INDEX "Chatbot_status_idx" ON "Chatbot"("status");

-- CreateIndex
CREATE INDEX "Chatbot_createdByUserId_idx" ON "Chatbot"("createdByUserId");

-- CreateIndex
CREATE INDEX "Chatbot_updatedByUserId_idx" ON "Chatbot"("updatedByUserId");

-- CreateIndex
CREATE INDEX "Chatbot_createdAt_idx" ON "Chatbot"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatbotVersion_chatbotId_versionNumber_key" ON "ChatbotVersion"("chatbotId", "versionNumber");

-- CreateIndex
CREATE INDEX "ChatbotVersion_companyId_idx" ON "ChatbotVersion"("companyId");

-- CreateIndex
CREATE INDEX "ChatbotVersion_chatbotId_idx" ON "ChatbotVersion"("chatbotId");

-- CreateIndex
CREATE INDEX "ChatbotVersion_status_idx" ON "ChatbotVersion"("status");

-- CreateIndex
CREATE INDEX "ChatbotVersion_createdByUserId_idx" ON "ChatbotVersion"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatbotNode_versionId_nodeKey_key" ON "ChatbotNode"("versionId", "nodeKey");

-- CreateIndex
CREATE INDEX "ChatbotNode_companyId_idx" ON "ChatbotNode"("companyId");

-- CreateIndex
CREATE INDEX "ChatbotNode_chatbotId_idx" ON "ChatbotNode"("chatbotId");

-- CreateIndex
CREATE INDEX "ChatbotNode_versionId_idx" ON "ChatbotNode"("versionId");

-- CreateIndex
CREATE INDEX "ChatbotNode_type_idx" ON "ChatbotNode"("type");

-- CreateIndex
CREATE INDEX "ChatbotEdge_companyId_idx" ON "ChatbotEdge"("companyId");

-- CreateIndex
CREATE INDEX "ChatbotEdge_chatbotId_idx" ON "ChatbotEdge"("chatbotId");

-- CreateIndex
CREATE INDEX "ChatbotEdge_versionId_idx" ON "ChatbotEdge"("versionId");

-- CreateIndex
CREATE INDEX "ChatbotEdge_sourceNodeId_idx" ON "ChatbotEdge"("sourceNodeId");

-- CreateIndex
CREATE INDEX "ChatbotEdge_targetNodeId_idx" ON "ChatbotEdge"("targetNodeId");

-- CreateIndex
CREATE INDEX "ChatbotTrigger_companyId_idx" ON "ChatbotTrigger"("companyId");

-- CreateIndex
CREATE INDEX "ChatbotTrigger_chatbotId_idx" ON "ChatbotTrigger"("chatbotId");

-- CreateIndex
CREATE INDEX "ChatbotTrigger_companyId_type_isEnabled_idx" ON "ChatbotTrigger"("companyId", "type", "isEnabled");

-- CreateIndex
CREATE INDEX "ChatbotTrigger_chatbotId_isEnabled_idx" ON "ChatbotTrigger"("chatbotId", "isEnabled");

-- CreateIndex
CREATE INDEX "ChatbotTrigger_priority_idx" ON "ChatbotTrigger"("priority");

-- CreateIndex
CREATE INDEX "ChatbotSession_companyId_idx" ON "ChatbotSession"("companyId");

-- CreateIndex
CREATE INDEX "ChatbotSession_chatbotId_idx" ON "ChatbotSession"("chatbotId");

-- CreateIndex
CREATE INDEX "ChatbotSession_versionId_idx" ON "ChatbotSession"("versionId");

-- CreateIndex
CREATE INDEX "ChatbotSession_contactId_idx" ON "ChatbotSession"("contactId");

-- CreateIndex
CREATE INDEX "ChatbotSession_currentNodeId_idx" ON "ChatbotSession"("currentNodeId");

-- CreateIndex
CREATE INDEX "ChatbotSession_triggerId_idx" ON "ChatbotSession"("triggerId");

-- CreateIndex
CREATE INDEX "ChatbotSession_status_idx" ON "ChatbotSession"("status");

-- CreateIndex
CREATE INDEX "ChatbotSession_lastInteractionAt_idx" ON "ChatbotSession"("lastInteractionAt");

-- CreateIndex
CREATE INDEX "ChatbotSessionEvent_companyId_idx" ON "ChatbotSessionEvent"("companyId");

-- CreateIndex
CREATE INDEX "ChatbotSessionEvent_sessionId_idx" ON "ChatbotSessionEvent"("sessionId");

-- CreateIndex
CREATE INDEX "ChatbotSessionEvent_chatbotId_idx" ON "ChatbotSessionEvent"("chatbotId");

-- CreateIndex
CREATE INDEX "ChatbotSessionEvent_versionId_idx" ON "ChatbotSessionEvent"("versionId");

-- CreateIndex
CREATE INDEX "ChatbotSessionEvent_nodeId_idx" ON "ChatbotSessionEvent"("nodeId");

-- CreateIndex
CREATE INDEX "ChatbotSessionEvent_messageId_idx" ON "ChatbotSessionEvent"("messageId");

-- CreateIndex
CREATE INDEX "ChatbotSessionEvent_eventType_idx" ON "ChatbotSessionEvent"("eventType");

-- CreateIndex
CREATE INDEX "ChatbotSessionEvent_createdAt_idx" ON "ChatbotSessionEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "Chatbot" ADD CONSTRAINT "Chatbot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chatbot" ADD CONSTRAINT "Chatbot_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "ChatbotVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chatbot" ADD CONSTRAINT "Chatbot_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chatbot" ADD CONSTRAINT "Chatbot_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotVersion" ADD CONSTRAINT "ChatbotVersion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotVersion" ADD CONSTRAINT "ChatbotVersion_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotVersion" ADD CONSTRAINT "ChatbotVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotNode" ADD CONSTRAINT "ChatbotNode_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotNode" ADD CONSTRAINT "ChatbotNode_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotNode" ADD CONSTRAINT "ChatbotNode_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ChatbotVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotEdge" ADD CONSTRAINT "ChatbotEdge_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotEdge" ADD CONSTRAINT "ChatbotEdge_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotEdge" ADD CONSTRAINT "ChatbotEdge_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ChatbotVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotEdge" ADD CONSTRAINT "ChatbotEdge_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "ChatbotNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotEdge" ADD CONSTRAINT "ChatbotEdge_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "ChatbotNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotTrigger" ADD CONSTRAINT "ChatbotTrigger_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotTrigger" ADD CONSTRAINT "ChatbotTrigger_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotSession" ADD CONSTRAINT "ChatbotSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotSession" ADD CONSTRAINT "ChatbotSession_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotSession" ADD CONSTRAINT "ChatbotSession_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ChatbotVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotSession" ADD CONSTRAINT "ChatbotSession_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotSession" ADD CONSTRAINT "ChatbotSession_currentNodeId_fkey" FOREIGN KEY ("currentNodeId") REFERENCES "ChatbotNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotSession" ADD CONSTRAINT "ChatbotSession_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "ChatbotTrigger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotSessionEvent" ADD CONSTRAINT "ChatbotSessionEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotSessionEvent" ADD CONSTRAINT "ChatbotSessionEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatbotSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotSessionEvent" ADD CONSTRAINT "ChatbotSessionEvent_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotSessionEvent" ADD CONSTRAINT "ChatbotSessionEvent_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ChatbotVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotSessionEvent" ADD CONSTRAINT "ChatbotSessionEvent_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "ChatbotNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotSessionEvent" ADD CONSTRAINT "ChatbotSessionEvent_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
