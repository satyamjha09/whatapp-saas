-- Extend the local template lifecycle to match Meta review and quality states.
ALTER TYPE "TemplateStatus" ADD VALUE IF NOT EXISTS 'SUBMITTING';
ALTER TYPE "TemplateStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "TemplateStatus" ADD VALUE IF NOT EXISTS 'REINSTATED';

CREATE TABLE "TemplateLifecycleEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "eventType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "previousCategory" TEXT,
    "newCategory" TEXT,
    "reason" TEXT,
    "qualityScore" TEXT,
    "metaTemplateId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateLifecycleEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TemplateLifecycleEvent_companyId_idx" ON "TemplateLifecycleEvent"("companyId");
CREATE INDEX "TemplateLifecycleEvent_templateId_idx" ON "TemplateLifecycleEvent"("templateId");
CREATE INDEX "TemplateLifecycleEvent_companyId_templateId_createdAt_idx" ON "TemplateLifecycleEvent"("companyId", "templateId", "createdAt");
CREATE INDEX "TemplateLifecycleEvent_eventType_idx" ON "TemplateLifecycleEvent"("eventType");
CREATE INDEX "TemplateLifecycleEvent_source_idx" ON "TemplateLifecycleEvent"("source");

ALTER TABLE "TemplateLifecycleEvent"
  ADD CONSTRAINT "TemplateLifecycleEvent_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TemplateLifecycleEvent"
  ADD CONSTRAINT "TemplateLifecycleEvent_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
