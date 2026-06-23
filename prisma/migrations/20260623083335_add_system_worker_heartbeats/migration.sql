-- CreateEnum
CREATE TYPE "SystemWorkerHeartbeatStatus" AS ENUM ('RUNNING', 'STOPPED', 'ERROR');

-- CreateTable
CREATE TABLE "SystemWorkerHeartbeat" (
    "id" TEXT NOT NULL,
    "workerName" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "status" "SystemWorkerHeartbeatStatus" NOT NULL DEFAULT 'RUNNING',
    "hostname" TEXT,
    "processId" INTEGER,
    "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stoppedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemWorkerHeartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemWorkerHeartbeat_instanceId_key" ON "SystemWorkerHeartbeat"("instanceId");

-- CreateIndex
CREATE INDEX "SystemWorkerHeartbeat_workerName_idx" ON "SystemWorkerHeartbeat"("workerName");

-- CreateIndex
CREATE INDEX "SystemWorkerHeartbeat_status_idx" ON "SystemWorkerHeartbeat"("status");

-- CreateIndex
CREATE INDEX "SystemWorkerHeartbeat_lastHeartbeatAt_idx" ON "SystemWorkerHeartbeat"("lastHeartbeatAt");
