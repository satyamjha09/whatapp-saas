-- AlterEnum
ALTER TYPE "ContactImportDuplicateStrategy" ADD VALUE 'CREATE_NEW_ONLY';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ContactImportJobStatus" ADD VALUE 'UPLOADED';
ALTER TYPE "ContactImportJobStatus" ADD VALUE 'MAPPING';
ALTER TYPE "ContactImportJobStatus" ADD VALUE 'READY';
ALTER TYPE "ContactImportJobStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ContactImportRowStatus" ADD VALUE 'PENDING';
ALTER TYPE "ContactImportRowStatus" ADD VALUE 'VALID';
ALTER TYPE "ContactImportRowStatus" ADD VALUE 'INVALID';
ALTER TYPE "ContactImportRowStatus" ADD VALUE 'DUPLICATE';

-- AlterTable
ALTER TABLE "ContactImportJob" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "columnMapping" JSONB,
ADD COLUMN     "contactGroupId" TEXT,
ADD COLUMN     "createGroupName" TEXT,
ADD COLUMN     "defaultCountryCode" TEXT,
ADD COLUMN     "duplicateRows" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fileSizeBytes" INTEGER,
ADD COLUMN     "fileType" TEXT,
ADD COLUMN     "headers" JSONB,
ADD COLUMN     "invalidRows" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "summary" JSONB,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "validRows" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ContactImportRow" ADD COLUMN     "countryCode" TEXT,
ADD COLUMN     "warnings" JSONB;
