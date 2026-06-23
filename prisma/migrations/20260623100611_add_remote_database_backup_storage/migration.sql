-- AlterTable
ALTER TABLE "DatabaseBackupRun" ADD COLUMN     "remoteBucket" TEXT,
ADD COLUMN     "remoteKey" TEXT,
ADD COLUMN     "remoteStorageEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "remoteUploadError" TEXT,
ADD COLUMN     "remoteUploadedAt" TIMESTAMP(3);
