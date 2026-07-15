-- Add customer satisfaction settings to each workspace.
ALTER TABLE "Company"
  ADD COLUMN "inboxCsatEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "inboxCsatDelayMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "inboxCsatExpirationHours" INTEGER NOT NULL DEFAULT 72,
  ADD COLUMN "inboxCsatLowScoreThreshold" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "inboxCsatSurveyMessage" TEXT NOT NULL DEFAULT 'Thanks for chatting with us. Please reply with a number from 1 to 5 to rate your support experience.',
  ADD COLUMN "inboxCsatFollowUpQuestion" TEXT;

-- Store one CSAT survey per conversation close cycle.
CREATE TABLE "InboxCsatSurvey" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "queueId" TEXT,
  "assignedToUserId" TEXT,
  "closedByUserId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "sentMessageId" TEXT,
  "score" INTEGER,
  "comment" TEXT,
  "sentAt" TIMESTAMP(3),
  "respondedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "closeCycleKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InboxCsatSurvey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InboxCsatSurvey_companyId_contactId_closeCycleKey_key"
  ON "InboxCsatSurvey"("companyId", "contactId", "closeCycleKey");

CREATE INDEX "InboxCsatSurvey_companyId_status_idx"
  ON "InboxCsatSurvey"("companyId", "status");

CREATE INDEX "InboxCsatSurvey_companyId_respondedAt_idx"
  ON "InboxCsatSurvey"("companyId", "respondedAt");

CREATE INDEX "InboxCsatSurvey_companyId_assignedToUserId_idx"
  ON "InboxCsatSurvey"("companyId", "assignedToUserId");

CREATE INDEX "InboxCsatSurvey_companyId_queueId_idx"
  ON "InboxCsatSurvey"("companyId", "queueId");

CREATE INDEX "InboxCsatSurvey_contactId_idx"
  ON "InboxCsatSurvey"("contactId");

CREATE INDEX "InboxCsatSurvey_sentMessageId_idx"
  ON "InboxCsatSurvey"("sentMessageId");

ALTER TABLE "InboxCsatSurvey"
  ADD CONSTRAINT "InboxCsatSurvey_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InboxCsatSurvey"
  ADD CONSTRAINT "InboxCsatSurvey_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InboxCsatSurvey"
  ADD CONSTRAINT "InboxCsatSurvey_queueId_fkey"
  FOREIGN KEY ("queueId") REFERENCES "InboxQueue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InboxCsatSurvey"
  ADD CONSTRAINT "InboxCsatSurvey_assignedToUserId_fkey"
  FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InboxCsatSurvey"
  ADD CONSTRAINT "InboxCsatSurvey_closedByUserId_fkey"
  FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InboxCsatSurvey"
  ADD CONSTRAINT "InboxCsatSurvey_sentMessageId_fkey"
  FOREIGN KEY ("sentMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
