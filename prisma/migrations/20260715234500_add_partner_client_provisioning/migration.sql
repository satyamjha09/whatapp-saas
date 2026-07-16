CREATE TYPE "PartnerClientRelationshipStatus" AS ENUM (
  'PROVISIONING',
  'INVITED',
  'ACTIVE',
  'SUSPENDED',
  'ARCHIVED'
);

CREATE TYPE "PartnerClientProvisioningJobStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELED'
);

CREATE TYPE "PartnerClientProvisioningEventType" AS ENUM (
  'CREATED',
  'PROCESSING_STARTED',
  'CLIENT_COMPANY_CREATED',
  'RELATIONSHIP_CREATED',
  'PLAN_ASSIGNED',
  'OWNER_INVITED',
  'COMPLETED',
  'FAILED',
  'RETRY_SCHEDULED',
  'RETRY_REQUESTED',
  'CANCELED'
);

CREATE TABLE "PartnerClientRelationship" (
  "id" TEXT NOT NULL,
  "partnerCompanyId" TEXT NOT NULL,
  "clientCompanyId" TEXT NOT NULL,
  "status" "PartnerClientRelationshipStatus" NOT NULL DEFAULT 'PROVISIONING',
  "clientOwnerInviteId" TEXT,
  "createdByUserId" TEXT,
  "externalClientReference" TEXT,
  "displayName" TEXT,
  "activatedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PartnerClientRelationship_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerClientProvisioningJob" (
  "id" TEXT NOT NULL,
  "partnerCompanyId" TEXT NOT NULL,
  "clientCompanyId" TEXT,
  "relationshipId" TEXT,
  "createdByUserId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "status" "PartnerClientProvisioningJobStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "requestedCompanyName" TEXT NOT NULL,
  "requestedOwnerEmail" TEXT NOT NULL,
  "requestedOwnerName" TEXT,
  "requestedPlan" "BillingPlan" NOT NULL DEFAULT 'FREE',
  "requestedPlanDays" INTEGER NOT NULL DEFAULT 14,
  "externalClientReference" TEXT,
  "lastError" TEXT,
  "nextRetryAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PartnerClientProvisioningJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerClientProvisioningEvent" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "type" "PartnerClientProvisioningEventType" NOT NULL,
  "message" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PartnerClientProvisioningEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerClientRelationship_clientCompanyId_key"
  ON "PartnerClientRelationship"("clientCompanyId");

CREATE UNIQUE INDEX "PartnerClientRelationship_partnerCompanyId_clientCompanyId_key"
  ON "PartnerClientRelationship"("partnerCompanyId", "clientCompanyId");

CREATE INDEX "PartnerClientRelationship_partnerCompanyId_status_idx"
  ON "PartnerClientRelationship"("partnerCompanyId", "status");

CREATE INDEX "PartnerClientRelationship_clientOwnerInviteId_idx"
  ON "PartnerClientRelationship"("clientOwnerInviteId");

CREATE INDEX "PartnerClientRelationship_createdByUserId_idx"
  ON "PartnerClientRelationship"("createdByUserId");

CREATE UNIQUE INDEX "PartnerClientProvisioningJob_idempotencyKey_key"
  ON "PartnerClientProvisioningJob"("idempotencyKey");

CREATE INDEX "PartnerClientProvisioningJob_partnerCompanyId_status_idx"
  ON "PartnerClientProvisioningJob"("partnerCompanyId", "status");

CREATE INDEX "PartnerClientProvisioningJob_clientCompanyId_idx"
  ON "PartnerClientProvisioningJob"("clientCompanyId");

CREATE INDEX "PartnerClientProvisioningJob_relationshipId_idx"
  ON "PartnerClientProvisioningJob"("relationshipId");

CREATE INDEX "PartnerClientProvisioningJob_createdByUserId_idx"
  ON "PartnerClientProvisioningJob"("createdByUserId");

CREATE INDEX "PartnerClientProvisioningJob_nextRetryAt_idx"
  ON "PartnerClientProvisioningJob"("nextRetryAt");

CREATE INDEX "PartnerClientProvisioningEvent_jobId_idx"
  ON "PartnerClientProvisioningEvent"("jobId");

CREATE INDEX "PartnerClientProvisioningEvent_type_idx"
  ON "PartnerClientProvisioningEvent"("type");

CREATE INDEX "PartnerClientProvisioningEvent_createdAt_idx"
  ON "PartnerClientProvisioningEvent"("createdAt");

ALTER TABLE "PartnerClientRelationship"
  ADD CONSTRAINT "PartnerClientRelationship_partnerCompanyId_fkey"
  FOREIGN KEY ("partnerCompanyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PartnerClientRelationship"
  ADD CONSTRAINT "PartnerClientRelationship_clientCompanyId_fkey"
  FOREIGN KEY ("clientCompanyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PartnerClientRelationship"
  ADD CONSTRAINT "PartnerClientRelationship_clientOwnerInviteId_fkey"
  FOREIGN KEY ("clientOwnerInviteId") REFERENCES "CompanyInvite"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PartnerClientRelationship"
  ADD CONSTRAINT "PartnerClientRelationship_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PartnerClientProvisioningJob"
  ADD CONSTRAINT "PartnerClientProvisioningJob_partnerCompanyId_fkey"
  FOREIGN KEY ("partnerCompanyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PartnerClientProvisioningJob"
  ADD CONSTRAINT "PartnerClientProvisioningJob_clientCompanyId_fkey"
  FOREIGN KEY ("clientCompanyId") REFERENCES "Company"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PartnerClientProvisioningJob"
  ADD CONSTRAINT "PartnerClientProvisioningJob_relationshipId_fkey"
  FOREIGN KEY ("relationshipId") REFERENCES "PartnerClientRelationship"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PartnerClientProvisioningJob"
  ADD CONSTRAINT "PartnerClientProvisioningJob_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PartnerClientProvisioningEvent"
  ADD CONSTRAINT "PartnerClientProvisioningEvent_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "PartnerClientProvisioningJob"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
