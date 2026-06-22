-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "DeveloperApiRequestLog" ADD COLUMN     "requiredScope" TEXT;
