-- CreateEnum
CREATE TYPE "DatabaseBackupVerificationStatus" AS ENUM ('NOT_VERIFIED', 'VERIFIED', 'FAILED');

-- AlterTable
ALTER TABLE "DatabaseBackupRun" ADD COLUMN     "verificationError" TEXT,
ADD COLUMN     "verificationStatus" "DatabaseBackupVerificationStatus" NOT NULL DEFAULT 'NOT_VERIFIED',
ADD COLUMN     "verifiedAt" TIMESTAMP(3);
