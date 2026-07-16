-- CreateEnum
CREATE TYPE "PartnerSupportTicketStatus" AS ENUM ('OPEN', 'PENDING_PARTNER', 'PENDING_METAWHAT', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PartnerSupportTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "PartnerSupportTicketCategory" AS ENUM ('GENERAL', 'BILLING', 'TECHNICAL', 'WHATSAPP', 'API', 'CLIENT_ACCESS', 'FEATURE_REQUEST');

-- CreateEnum
CREATE TYPE "PartnerSupportCommentVisibility" AS ENUM ('PARTNER', 'INTERNAL');

-- CreateEnum
CREATE TYPE "PartnerSupportTicketEventType" AS ENUM ('CREATED', 'COMMENT_ADDED', 'ASSIGNED', 'STATUS_CHANGED', 'PRIORITY_CHANGED', 'ESCALATED', 'RESOLVED', 'CLOSED', 'CSAT_RECORDED');

-- CreateTable
CREATE TABLE "PartnerSupportTicket" (
    "id" TEXT NOT NULL,
    "partnerCompanyId" TEXT NOT NULL,
    "clientCompanyId" TEXT,
    "openedByUserId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "PartnerSupportTicketCategory" NOT NULL DEFAULT 'GENERAL',
    "priority" "PartnerSupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "PartnerSupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "assignedPlatformUserId" TEXT,
    "firstResponseDueAt" TIMESTAMP(3),
    "resolutionDueAt" TIMESTAMP(3),
    "firstRespondedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "csatScore" INTEGER,
    "csatComment" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerSupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerSupportTicketComment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "visibility" "PartnerSupportCommentVisibility" NOT NULL DEFAULT 'PARTNER',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerSupportTicketComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerSupportTicketEvent" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "partnerCompanyId" TEXT NOT NULL,
    "clientCompanyId" TEXT,
    "actorUserId" TEXT,
    "type" "PartnerSupportTicketEventType" NOT NULL,
    "previousValues" JSONB,
    "newValues" JSONB,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerSupportTicketEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerSupportTicket_partnerCompanyId_status_idx" ON "PartnerSupportTicket"("partnerCompanyId", "status");

-- CreateIndex
CREATE INDEX "PartnerSupportTicket_partnerCompanyId_priority_idx" ON "PartnerSupportTicket"("partnerCompanyId", "priority");

-- CreateIndex
CREATE INDEX "PartnerSupportTicket_clientCompanyId_idx" ON "PartnerSupportTicket"("clientCompanyId");

-- CreateIndex
CREATE INDEX "PartnerSupportTicket_openedByUserId_idx" ON "PartnerSupportTicket"("openedByUserId");

-- CreateIndex
CREATE INDEX "PartnerSupportTicket_assignedPlatformUserId_idx" ON "PartnerSupportTicket"("assignedPlatformUserId");

-- CreateIndex
CREATE INDEX "PartnerSupportTicket_firstResponseDueAt_idx" ON "PartnerSupportTicket"("firstResponseDueAt");

-- CreateIndex
CREATE INDEX "PartnerSupportTicket_resolutionDueAt_idx" ON "PartnerSupportTicket"("resolutionDueAt");

-- CreateIndex
CREATE INDEX "PartnerSupportTicket_createdAt_idx" ON "PartnerSupportTicket"("createdAt");

-- CreateIndex
CREATE INDEX "PartnerSupportTicketComment_ticketId_idx" ON "PartnerSupportTicketComment"("ticketId");

-- CreateIndex
CREATE INDEX "PartnerSupportTicketComment_authorUserId_idx" ON "PartnerSupportTicketComment"("authorUserId");

-- CreateIndex
CREATE INDEX "PartnerSupportTicketComment_visibility_idx" ON "PartnerSupportTicketComment"("visibility");

-- CreateIndex
CREATE INDEX "PartnerSupportTicketComment_createdAt_idx" ON "PartnerSupportTicketComment"("createdAt");

-- CreateIndex
CREATE INDEX "PartnerSupportTicketEvent_ticketId_idx" ON "PartnerSupportTicketEvent"("ticketId");

-- CreateIndex
CREATE INDEX "PartnerSupportTicketEvent_partnerCompanyId_idx" ON "PartnerSupportTicketEvent"("partnerCompanyId");

-- CreateIndex
CREATE INDEX "PartnerSupportTicketEvent_clientCompanyId_idx" ON "PartnerSupportTicketEvent"("clientCompanyId");

-- CreateIndex
CREATE INDEX "PartnerSupportTicketEvent_actorUserId_idx" ON "PartnerSupportTicketEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "PartnerSupportTicketEvent_type_idx" ON "PartnerSupportTicketEvent"("type");

-- CreateIndex
CREATE INDEX "PartnerSupportTicketEvent_createdAt_idx" ON "PartnerSupportTicketEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "PartnerSupportTicket" ADD CONSTRAINT "PartnerSupportTicket_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerSupportTicket" ADD CONSTRAINT "PartnerSupportTicket_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerSupportTicket" ADD CONSTRAINT "PartnerSupportTicket_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerSupportTicket" ADD CONSTRAINT "PartnerSupportTicket_assignedPlatformUserId_fkey" FOREIGN KEY ("assignedPlatformUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerSupportTicketComment" ADD CONSTRAINT "PartnerSupportTicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "PartnerSupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerSupportTicketComment" ADD CONSTRAINT "PartnerSupportTicketComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerSupportTicketEvent" ADD CONSTRAINT "PartnerSupportTicketEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "PartnerSupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerSupportTicketEvent" ADD CONSTRAINT "PartnerSupportTicketEvent_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerSupportTicketEvent" ADD CONSTRAINT "PartnerSupportTicketEvent_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerSupportTicketEvent" ADD CONSTRAINT "PartnerSupportTicketEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
