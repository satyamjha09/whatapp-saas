-- CreateEnum
CREATE TYPE "InboxReplyApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InboxReplyApprovalMode" AS ENUM ('NEVER', 'ALWAYS', 'ROLE_BASED', 'HIGH_RISK');

-- AlterTable
ALTER TABLE "Message"
ADD COLUMN     "sentByUserId" TEXT,
ADD COLUMN     "approvedByUserId" TEXT,
ADD COLUMN     "inboxReplyApprovalId" TEXT;

-- CreateTable
CREATE TABLE "InboxReplyApproval" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "queueId" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "status" "InboxReplyApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "body" TEXT NOT NULL,
    "rejectionReason" TEXT,
    "messageId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxReplyApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InboxReplyApproval_companyId_status_idx" ON "InboxReplyApproval"("companyId", "status");

-- CreateIndex
CREATE INDEX "InboxReplyApproval_requestedByUserId_status_idx" ON "InboxReplyApproval"("requestedByUserId", "status");

-- CreateIndex
CREATE INDEX "InboxReplyApproval_reviewedByUserId_idx" ON "InboxReplyApproval"("reviewedByUserId");

-- CreateIndex
CREATE INDEX "InboxReplyApproval_contactId_idx" ON "InboxReplyApproval"("contactId");

-- CreateIndex
CREATE INDEX "InboxReplyApproval_queueId_idx" ON "InboxReplyApproval"("queueId");

-- CreateIndex
CREATE INDEX "InboxReplyApproval_messageId_idx" ON "InboxReplyApproval"("messageId");

-- CreateIndex
CREATE INDEX "Message_sentByUserId_idx" ON "Message"("sentByUserId");

-- CreateIndex
CREATE INDEX "Message_approvedByUserId_idx" ON "Message"("approvedByUserId");

-- CreateIndex
CREATE INDEX "Message_inboxReplyApprovalId_idx" ON "Message"("inboxReplyApprovalId");

-- AddForeignKey
ALTER TABLE "InboxReplyApproval" ADD CONSTRAINT "InboxReplyApproval_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxReplyApproval" ADD CONSTRAINT "InboxReplyApproval_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxReplyApproval" ADD CONSTRAINT "InboxReplyApproval_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "InboxQueue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxReplyApproval" ADD CONSTRAINT "InboxReplyApproval_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxReplyApproval" ADD CONSTRAINT "InboxReplyApproval_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxReplyApproval" ADD CONSTRAINT "InboxReplyApproval_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_inboxReplyApprovalId_fkey" FOREIGN KEY ("inboxReplyApprovalId") REFERENCES "InboxReplyApproval"("id") ON DELETE SET NULL ON UPDATE CASCADE;
