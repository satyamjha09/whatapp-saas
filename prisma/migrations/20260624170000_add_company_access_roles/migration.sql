CREATE TYPE "RbacPermission" AS ENUM (
  'DASHBOARD_VIEW', 'INBOX_VIEW', 'INBOX_REPLY', 'INBOX_ASSIGN', 'INBOX_CLOSE', 'INBOX_BULK_ACTION',
  'CONTACT_VIEW', 'CONTACT_CREATE', 'CONTACT_UPDATE', 'CONTACT_DELETE', 'CONTACT_EXPORT',
  'CAMPAIGN_VIEW', 'CAMPAIGN_CREATE', 'CAMPAIGN_SEND', 'CAMPAIGN_CANCEL', 'CAMPAIGN_ANALYTICS_VIEW',
  'TEMPLATE_VIEW', 'TEMPLATE_SYNC', 'TEMPLATE_CREATE', 'WALLET_VIEW', 'BILLING_VIEW', 'BILLING_MANAGE',
  'DEVELOPER_VIEW', 'DEVELOPER_API_KEYS_MANAGE', 'DEVELOPER_WEBHOOKS_MANAGE',
  'WHATSAPP_SETTINGS_VIEW', 'WHATSAPP_SETTINGS_MANAGE', 'TEAM_VIEW', 'TEAM_INVITE', 'TEAM_MANAGE_ROLES',
  'SYSTEM_HEALTH_VIEW', 'SYSTEM_OPERATIONS_MANAGE', 'COMPLIANCE_VIEW', 'COMPLIANCE_MANAGE',
  'PRIVACY_REQUEST_VIEW', 'PRIVACY_REQUEST_PROCESS', 'TRUST_CENTER_VIEW', 'TRUST_CENTER_MANAGE'
);

CREATE TYPE "CompanyAccessRoleStatus" AS ENUM ('ACTIVE', 'DISABLED');

CREATE TABLE "CompanyAccessRole" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "status" "CompanyAccessRoleStatus" NOT NULL DEFAULT 'ACTIVE',
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "permissions" "RbacPermission"[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyAccessRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyAccessRoleAssignment" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "assignedByUserId" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyAccessRoleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyAccessRole_companyId_slug_key" ON "CompanyAccessRole"("companyId", "slug");
CREATE INDEX "CompanyAccessRole_companyId_idx" ON "CompanyAccessRole"("companyId");
CREATE INDEX "CompanyAccessRole_status_idx" ON "CompanyAccessRole"("status");
CREATE INDEX "CompanyAccessRole_isSystem_idx" ON "CompanyAccessRole"("isSystem");
CREATE UNIQUE INDEX "CompanyAccessRoleAssignment_companyId_userId_key" ON "CompanyAccessRoleAssignment"("companyId", "userId");
CREATE INDEX "CompanyAccessRoleAssignment_companyId_idx" ON "CompanyAccessRoleAssignment"("companyId");
CREATE INDEX "CompanyAccessRoleAssignment_userId_idx" ON "CompanyAccessRoleAssignment"("userId");
CREATE INDEX "CompanyAccessRoleAssignment_roleId_idx" ON "CompanyAccessRoleAssignment"("roleId");

ALTER TABLE "CompanyAccessRole" ADD CONSTRAINT "CompanyAccessRole_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyAccessRoleAssignment" ADD CONSTRAINT "CompanyAccessRoleAssignment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyAccessRoleAssignment" ADD CONSTRAINT "CompanyAccessRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyAccessRoleAssignment" ADD CONSTRAINT "CompanyAccessRoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "CompanyAccessRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
