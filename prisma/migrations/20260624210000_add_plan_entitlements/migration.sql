CREATE TYPE "FeatureEntitlementKey" AS ENUM ('INBOX', 'CONTACTS', 'CRM', 'CAMPAIGNS', 'BULK_MESSAGING', 'TEMPLATES', 'ANALYTICS', 'DEVELOPER_API', 'DEVELOPER_WEBHOOKS', 'WHATSAPP_SETTINGS', 'TEAM', 'RBAC', 'BILLING', 'WALLET', 'PRIVACY_CENTER', 'CONSENT_CENTER', 'TRUST_CENTER', 'STATUS_PAGE', 'COMPLIANCE_EXPORTS', 'SYSTEM_OPERATIONS');
CREATE TYPE "FeatureEntitlementCheckResult" AS ENUM ('ALLOWED', 'BLOCKED');
CREATE TYPE "CompanyEntitlementOverrideStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'DISABLED');

CREATE TABLE "PlanEntitlement" (
  "id" TEXT NOT NULL, "billingPlan" "BillingPlan" NOT NULL, "featureKey" "FeatureEntitlementKey" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true, "limitValue" INTEGER, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlanEntitlement_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CompanyEntitlementOverride" (
  "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "featureKey" "FeatureEntitlementKey" NOT NULL,
  "status" "CompanyEntitlementOverrideStatus" NOT NULL DEFAULT 'ACTIVE', "enabledOverride" BOOLEAN,
  "limitOverride" INTEGER, "reason" TEXT, "expiresAt" TIMESTAMP(3), "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyEntitlementOverride_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FeatureEntitlementCheckLog" (
  "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "userId" TEXT, "featureKey" "FeatureEntitlementKey" NOT NULL,
  "result" "FeatureEntitlementCheckResult" NOT NULL, "billingPlan" "BillingPlan", "routePath" TEXT,
  "method" TEXT, "reason" TEXT, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeatureEntitlementCheckLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlanEntitlement_billingPlan_featureKey_key" ON "PlanEntitlement"("billingPlan", "featureKey");
CREATE INDEX "PlanEntitlement_billingPlan_idx" ON "PlanEntitlement"("billingPlan");
CREATE INDEX "PlanEntitlement_featureKey_idx" ON "PlanEntitlement"("featureKey");
CREATE INDEX "PlanEntitlement_enabled_idx" ON "PlanEntitlement"("enabled");
CREATE INDEX "CompanyEntitlementOverride_companyId_idx" ON "CompanyEntitlementOverride"("companyId");
CREATE INDEX "CompanyEntitlementOverride_featureKey_idx" ON "CompanyEntitlementOverride"("featureKey");
CREATE INDEX "CompanyEntitlementOverride_status_idx" ON "CompanyEntitlementOverride"("status");
CREATE INDEX "CompanyEntitlementOverride_expiresAt_idx" ON "CompanyEntitlementOverride"("expiresAt");
CREATE INDEX "FeatureEntitlementCheckLog_companyId_idx" ON "FeatureEntitlementCheckLog"("companyId");
CREATE INDEX "FeatureEntitlementCheckLog_userId_idx" ON "FeatureEntitlementCheckLog"("userId");
CREATE INDEX "FeatureEntitlementCheckLog_featureKey_idx" ON "FeatureEntitlementCheckLog"("featureKey");
CREATE INDEX "FeatureEntitlementCheckLog_result_idx" ON "FeatureEntitlementCheckLog"("result");
CREATE INDEX "FeatureEntitlementCheckLog_createdAt_idx" ON "FeatureEntitlementCheckLog"("createdAt");

ALTER TABLE "CompanyEntitlementOverride" ADD CONSTRAINT "CompanyEntitlementOverride_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyEntitlementOverride" ADD CONSTRAINT "CompanyEntitlementOverride_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeatureEntitlementCheckLog" ADD CONSTRAINT "FeatureEntitlementCheckLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeatureEntitlementCheckLog" ADD CONSTRAINT "FeatureEntitlementCheckLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
