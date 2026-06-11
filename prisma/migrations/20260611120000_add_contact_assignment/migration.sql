-- Add nullable contact assignment for inbox filtering.
ALTER TABLE "Contact" ADD COLUMN "assignedToUserId" TEXT;

ALTER TABLE "Contact" ADD CONSTRAINT "Contact_assignedToUserId_fkey"
FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Contact_assignedToUserId_idx" ON "Contact"("assignedToUserId");
