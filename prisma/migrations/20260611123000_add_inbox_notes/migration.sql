CREATE TABLE "InboxNote" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxNote_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InboxNote" ADD CONSTRAINT "InboxNote_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InboxNote" ADD CONSTRAINT "InboxNote_contactId_fkey"
FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InboxNote" ADD CONSTRAINT "InboxNote_authorUserId_fkey"
FOREIGN KEY ("authorUserId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "InboxNote_companyId_idx" ON "InboxNote"("companyId");
CREATE INDEX "InboxNote_companyId_contactId_idx" ON "InboxNote"("companyId", "contactId");
CREATE INDEX "InboxNote_authorUserId_idx" ON "InboxNote"("authorUserId");
