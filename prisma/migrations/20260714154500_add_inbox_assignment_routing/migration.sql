-- CreateTable
CREATE TABLE "InboxRoutingRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "conditions" JSONB NOT NULL,
    "targetQueueId" TEXT NOT NULL,
    "assignmentMode" "InboxAssignmentMode",
    "requiredSkillIds" JSONB,
    "fallbackQueueId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxRoutingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxConversationAssignment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "queueId" TEXT,
    "assignedToUserId" TEXT,
    "previousQueueId" TEXT,
    "previousUserId" TEXT,
    "source" "InboxAssignmentSource" NOT NULL,
    "ruleId" TEXT,
    "actorUserId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),

    CONSTRAINT "InboxConversationAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InboxRoutingRule_companyId_status_priority_idx" ON "InboxRoutingRule"("companyId", "status", "priority");

-- CreateIndex
CREATE INDEX "InboxRoutingRule_targetQueueId_idx" ON "InboxRoutingRule"("targetQueueId");

-- CreateIndex
CREATE INDEX "InboxRoutingRule_fallbackQueueId_idx" ON "InboxRoutingRule"("fallbackQueueId");

-- CreateIndex
CREATE INDEX "InboxConversationAssignment_companyId_contactId_idx" ON "InboxConversationAssignment"("companyId", "contactId");

-- CreateIndex
CREATE INDEX "InboxConversationAssignment_assignedToUserId_assignedAt_idx" ON "InboxConversationAssignment"("assignedToUserId", "assignedAt");

-- CreateIndex
CREATE INDEX "InboxConversationAssignment_queueId_assignedAt_idx" ON "InboxConversationAssignment"("queueId", "assignedAt");

-- CreateIndex
CREATE INDEX "InboxConversationAssignment_ruleId_idx" ON "InboxConversationAssignment"("ruleId");

-- AddForeignKey
ALTER TABLE "InboxRoutingRule" ADD CONSTRAINT "InboxRoutingRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxRoutingRule" ADD CONSTRAINT "InboxRoutingRule_targetQueueId_fkey" FOREIGN KEY ("targetQueueId") REFERENCES "InboxQueue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxRoutingRule" ADD CONSTRAINT "InboxRoutingRule_fallbackQueueId_fkey" FOREIGN KEY ("fallbackQueueId") REFERENCES "InboxQueue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxConversationAssignment" ADD CONSTRAINT "InboxConversationAssignment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxConversationAssignment" ADD CONSTRAINT "InboxConversationAssignment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxConversationAssignment" ADD CONSTRAINT "InboxConversationAssignment_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "InboxQueue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxConversationAssignment" ADD CONSTRAINT "InboxConversationAssignment_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxConversationAssignment" ADD CONSTRAINT "InboxConversationAssignment_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxConversationAssignment" ADD CONSTRAINT "InboxConversationAssignment_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "InboxRoutingRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
