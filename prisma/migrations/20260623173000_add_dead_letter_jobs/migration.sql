-- CreateEnum
CREATE TYPE "DeadLetterJobStatus" AS ENUM ('FAILED', 'RETRIED', 'IGNORED', 'RESOLVED');

-- CreateTable
CREATE TABLE "DeadLetterJob" (
    "id" TEXT NOT NULL,
    "queueName" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "jobName" TEXT,
    "status" "DeadLetterJobStatus" NOT NULL DEFAULT 'FAILED',
    "attemptsMade" INTEGER NOT NULL DEFAULT 0,
    "failedReason" TEXT,
    "stacktrace" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "payload" JSONB,
    "returnValue" JSONB,
    "firstFailedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastFailedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retriedAt" TIMESTAMP(3),
    "retriedByUserId" TEXT,
    "ignoredAt" TIMESTAMP(3),
    "ignoredByUserId" TEXT,
    "ignoreReason" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeadLetterJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeadLetterJob_queueName_jobId_key" ON "DeadLetterJob"("queueName", "jobId");

-- CreateIndex
CREATE INDEX "DeadLetterJob_queueName_idx" ON "DeadLetterJob"("queueName");

-- CreateIndex
CREATE INDEX "DeadLetterJob_status_idx" ON "DeadLetterJob"("status");

-- CreateIndex
CREATE INDEX "DeadLetterJob_lastFailedAt_idx" ON "DeadLetterJob"("lastFailedAt");
