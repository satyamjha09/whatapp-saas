-- CreateEnum
CREATE TYPE "DatabaseBackupStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "DatabaseBackupRun" (
    "id" TEXT NOT NULL,
    "status" "DatabaseBackupStatus" NOT NULL DEFAULT 'RUNNING',
    "fileName" TEXT,
    "filePath" TEXT,
    "sizeBytes" INTEGER,
    "checksumSha256" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatabaseBackupRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DatabaseBackupRun_status_idx" ON "DatabaseBackupRun"("status");

-- CreateIndex
CREATE INDEX "DatabaseBackupRun_startedAt_idx" ON "DatabaseBackupRun"("startedAt");
