CREATE TABLE "InboxTag" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'gray',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxTag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContactInboxTag" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactInboxTag_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InboxTag" ADD CONSTRAINT "InboxTag_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContactInboxTag" ADD CONSTRAINT "ContactInboxTag_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContactInboxTag" ADD CONSTRAINT "ContactInboxTag_contactId_fkey"
FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContactInboxTag" ADD CONSTRAINT "ContactInboxTag_tagId_fkey"
FOREIGN KEY ("tagId") REFERENCES "InboxTag"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "InboxTag_companyId_name_key" ON "InboxTag"("companyId", "name");
CREATE INDEX "InboxTag_companyId_idx" ON "InboxTag"("companyId");
CREATE UNIQUE INDEX "ContactInboxTag_contactId_tagId_key" ON "ContactInboxTag"("contactId", "tagId");
CREATE INDEX "ContactInboxTag_companyId_idx" ON "ContactInboxTag"("companyId");
CREATE INDEX "ContactInboxTag_companyId_tagId_idx" ON "ContactInboxTag"("companyId", "tagId");
