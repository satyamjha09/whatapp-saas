CREATE TABLE "QuickReply" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuickReply_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "QuickReply" ADD CONSTRAINT "QuickReply_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuickReply" ADD CONSTRAINT "QuickReply_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "QuickReply_companyId_title_key" ON "QuickReply"("companyId", "title");
CREATE INDEX "QuickReply_companyId_idx" ON "QuickReply"("companyId");
CREATE INDEX "QuickReply_createdByUserId_idx" ON "QuickReply"("createdByUserId");
