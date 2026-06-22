CREATE TABLE "DeveloperApiUsage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL DEFAULT 'unknown',
    "date" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeveloperApiUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeveloperApiUsage_companyId_apiKeyId_date_key"
ON "DeveloperApiUsage"("companyId", "apiKeyId", "date");
CREATE INDEX "DeveloperApiUsage_companyId_idx" ON "DeveloperApiUsage"("companyId");
CREATE INDEX "DeveloperApiUsage_apiKeyId_idx" ON "DeveloperApiUsage"("apiKeyId");
CREATE INDEX "DeveloperApiUsage_date_idx" ON "DeveloperApiUsage"("date");

ALTER TABLE "DeveloperApiUsage"
ADD CONSTRAINT "DeveloperApiUsage_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
