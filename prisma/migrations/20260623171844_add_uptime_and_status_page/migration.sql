-- CreateEnum
CREATE TYPE "UptimeMonitorStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED');

-- CreateEnum
CREATE TYPE "UptimeCheckStatus" AS ENUM ('UP', 'DOWN', 'DEGRADED');

-- CreateEnum
CREATE TYPE "UptimeIncidentState" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "StatusPageVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "StatusPageComponentStatus" AS ENUM ('OPERATIONAL', 'DEGRADED', 'PARTIAL_OUTAGE', 'MAJOR_OUTAGE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "StatusPageIncidentStatus" AS ENUM ('INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "StatusPageIncidentImpact" AS ENUM ('NONE', 'MINOR', 'MAJOR', 'CRITICAL', 'MAINTENANCE');

-- CreateTable
CREATE TABLE "UptimeMonitor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'GET',
    "expectedStatus" INTEGER NOT NULL DEFAULT 200,
    "timeoutMs" INTEGER NOT NULL DEFAULT 10000,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 5,
    "status" "UptimeMonitorStatus" NOT NULL DEFAULT 'ACTIVE',
    "failureThreshold" INTEGER NOT NULL DEFAULT 3,
    "recoveryThreshold" INTEGER NOT NULL DEFAULT 2,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "consecutiveSuccesses" INTEGER NOT NULL DEFAULT 0,
    "lastStatus" "UptimeCheckStatus",
    "lastStatusCode" INTEGER,
    "lastLatencyMs" INTEGER,
    "lastCheckedAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "openIncidentState" "UptimeIncidentState",
    "openIncidentId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UptimeMonitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UptimeCheck" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "status" "UptimeCheckStatus" NOT NULL,
    "statusCode" INTEGER,
    "latencyMs" INTEGER,
    "errorMessage" TEXT,
    "responseSnippet" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UptimeCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "visibility" "StatusPageVisibility" NOT NULL DEFAULT 'PUBLIC',
    "supportEmail" TEXT,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatusPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusPageComponent" (
    "id" TEXT NOT NULL,
    "statusPageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "StatusPageComponentStatus" NOT NULL DEFAULT 'OPERATIONAL',
    "uptimeMonitorId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "lastCheckedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatusPageComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusPageIncident" (
    "id" TEXT NOT NULL,
    "statusPageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "status" "StatusPageIncidentStatus" NOT NULL DEFAULT 'INVESTIGATING',
    "impact" "StatusPageIncidentImpact" NOT NULL DEFAULT 'MINOR',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatusPageIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusPageIncidentUpdate" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "status" "StatusPageIncidentStatus" NOT NULL,
    "message" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusPageIncidentUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UptimeMonitor_status_idx" ON "UptimeMonitor"("status");

-- CreateIndex
CREATE INDEX "UptimeMonitor_lastStatus_idx" ON "UptimeMonitor"("lastStatus");

-- CreateIndex
CREATE INDEX "UptimeMonitor_lastCheckedAt_idx" ON "UptimeMonitor"("lastCheckedAt");

-- CreateIndex
CREATE INDEX "UptimeMonitor_openIncidentState_idx" ON "UptimeMonitor"("openIncidentState");

-- CreateIndex
CREATE INDEX "UptimeCheck_monitorId_idx" ON "UptimeCheck"("monitorId");

-- CreateIndex
CREATE INDEX "UptimeCheck_status_idx" ON "UptimeCheck"("status");

-- CreateIndex
CREATE INDEX "UptimeCheck_checkedAt_idx" ON "UptimeCheck"("checkedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StatusPage_slug_key" ON "StatusPage"("slug");

-- CreateIndex
CREATE INDEX "StatusPage_visibility_idx" ON "StatusPage"("visibility");

-- CreateIndex
CREATE INDEX "StatusPage_isDefault_idx" ON "StatusPage"("isDefault");

-- CreateIndex
CREATE INDEX "StatusPageComponent_statusPageId_idx" ON "StatusPageComponent"("statusPageId");

-- CreateIndex
CREATE INDEX "StatusPageComponent_status_idx" ON "StatusPageComponent"("status");

-- CreateIndex
CREATE INDEX "StatusPageComponent_uptimeMonitorId_idx" ON "StatusPageComponent"("uptimeMonitorId");

-- CreateIndex
CREATE INDEX "StatusPageComponent_sortOrder_idx" ON "StatusPageComponent"("sortOrder");

-- CreateIndex
CREATE INDEX "StatusPageIncident_statusPageId_idx" ON "StatusPageIncident"("statusPageId");

-- CreateIndex
CREATE INDEX "StatusPageIncident_status_idx" ON "StatusPageIncident"("status");

-- CreateIndex
CREATE INDEX "StatusPageIncident_impact_idx" ON "StatusPageIncident"("impact");

-- CreateIndex
CREATE INDEX "StatusPageIncident_startedAt_idx" ON "StatusPageIncident"("startedAt");

-- CreateIndex
CREATE INDEX "StatusPageIncident_resolvedAt_idx" ON "StatusPageIncident"("resolvedAt");

-- CreateIndex
CREATE INDEX "StatusPageIncidentUpdate_incidentId_idx" ON "StatusPageIncidentUpdate"("incidentId");

-- CreateIndex
CREATE INDEX "StatusPageIncidentUpdate_status_idx" ON "StatusPageIncidentUpdate"("status");

-- CreateIndex
CREATE INDEX "StatusPageIncidentUpdate_createdAt_idx" ON "StatusPageIncidentUpdate"("createdAt");

-- AddForeignKey
ALTER TABLE "UptimeCheck" ADD CONSTRAINT "UptimeCheck_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "UptimeMonitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusPageComponent" ADD CONSTRAINT "StatusPageComponent_statusPageId_fkey" FOREIGN KEY ("statusPageId") REFERENCES "StatusPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusPageIncident" ADD CONSTRAINT "StatusPageIncident_statusPageId_fkey" FOREIGN KEY ("statusPageId") REFERENCES "StatusPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusPageIncidentUpdate" ADD CONSTRAINT "StatusPageIncidentUpdate_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "StatusPageIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
