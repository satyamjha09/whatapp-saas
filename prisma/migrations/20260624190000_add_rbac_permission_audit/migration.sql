CREATE TYPE "RbacPermissionAuditRunStatus" AS ENUM ('PASSED', 'FAILED');
CREATE TYPE "RbacPermissionAuditItemSeverity" AS ENUM ('INFO', 'WARN', 'ERROR');

CREATE TABLE "RbacPermissionAuditRun" (
  "id" TEXT NOT NULL,
  "status" "RbacPermissionAuditRunStatus" NOT NULL,
  "totalRoutes" INTEGER NOT NULL DEFAULT 0,
  "guardedRoutes" INTEGER NOT NULL DEFAULT 0,
  "missingRegistry" INTEGER NOT NULL DEFAULT 0,
  "missingGuards" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RbacPermissionAuditRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RbacPermissionAuditItem" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "routePath" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "requiredPermission" "RbacPermission",
  "severity" "RbacPermissionAuditItemSeverity" NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RbacPermissionAuditItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RbacPermissionAuditRun_status_idx" ON "RbacPermissionAuditRun"("status");
CREATE INDEX "RbacPermissionAuditRun_createdAt_idx" ON "RbacPermissionAuditRun"("createdAt");
CREATE INDEX "RbacPermissionAuditItem_runId_idx" ON "RbacPermissionAuditItem"("runId");
CREATE INDEX "RbacPermissionAuditItem_severity_idx" ON "RbacPermissionAuditItem"("severity");
CREATE INDEX "RbacPermissionAuditItem_routePath_idx" ON "RbacPermissionAuditItem"("routePath");
CREATE INDEX "RbacPermissionAuditItem_createdAt_idx" ON "RbacPermissionAuditItem"("createdAt");

ALTER TABLE "RbacPermissionAuditItem" ADD CONSTRAINT "RbacPermissionAuditItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "RbacPermissionAuditRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
