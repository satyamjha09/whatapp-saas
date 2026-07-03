import { CompanyRole, RbacPermission } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export class PermissionDeniedError extends Error {
  constructor(permission: RbacPermission) {
    super(`Missing required permission: ${permission}`);
    this.name = "PermissionDeniedError";
  }
}

export function isRbacV2Enabled() {
  return process.env.RBAC_V2_ENABLED !== "false";
}

export function isRbacStrictMode() {
  return process.env.RBAC_V2_STRICT_MODE !== "false";
}

function permissions(...values: RbacPermission[]) {
  return values;
}

const AUTOMATION_ADMIN_PERMISSIONS = permissions(
  "AUTOMATION_FLOW_VIEW",
  "AUTOMATION_FLOW_CREATE",
  "AUTOMATION_FLOW_EDIT",
  "AUTOMATION_FLOW_DELETE",
  "AUTOMATION_FLOW_ARCHIVE",
  "AUTOMATION_FLOW_TEST",
  "AUTOMATION_FLOW_PUBLISH",
  "AUTOMATION_FLOW_REQUEST_PUBLISH",
  "AUTOMATION_FLOW_APPROVE_PUBLISH",
  "AUTOMATION_FLOW_REJECT_PUBLISH",
  "AUTOMATION_FLOW_ROLLBACK",
  "AUTOMATION_FLOW_PAUSE",
  "AUTOMATION_FLOW_RESUME",
  "AUTOMATION_ANALYTICS_VIEW",
  "AUTOMATION_EXECUTION_VIEW",
  "AUTOMATION_TEMPLATE_LIBRARY_USE",
  "AUTOMATION_MONITORING_VIEW",
  "AUTOMATION_ALERT_VIEW",
  "AUTOMATION_ALERT_MANAGE",
  "AUTOMATION_MONITORING_RUN_CHECKS",
);

const AUTOMATION_MANAGER_PERMISSIONS = permissions(
  "AUTOMATION_FLOW_VIEW",
  "AUTOMATION_FLOW_CREATE",
  "AUTOMATION_FLOW_EDIT",
  "AUTOMATION_FLOW_TEST",
  "AUTOMATION_FLOW_REQUEST_PUBLISH",
  "AUTOMATION_FLOW_ROLLBACK",
  "AUTOMATION_FLOW_PAUSE",
  "AUTOMATION_FLOW_RESUME",
  "AUTOMATION_ANALYTICS_VIEW",
  "AUTOMATION_EXECUTION_VIEW",
  "AUTOMATION_TEMPLATE_LIBRARY_USE",
  "AUTOMATION_MONITORING_VIEW",
  "AUTOMATION_ALERT_VIEW",
);

const AUTOMATION_VIEWER_PERMISSIONS = permissions(
  "AUTOMATION_FLOW_VIEW",
  "AUTOMATION_ANALYTICS_VIEW",
);

export const SYSTEM_ROLE_PERMISSIONS: Record<string, RbacPermission[]> = {
  owner: Object.values(RbacPermission),
  admin: permissions(
    "DASHBOARD_VIEW", "INBOX_VIEW", "INBOX_REPLY", "INBOX_ASSIGN", "INBOX_CLOSE",
    "INBOX_BULK_ACTION", "CONTACT_VIEW", "CONTACT_CREATE", "CONTACT_UPDATE",
    "CONTACT_EXPORT", "CAMPAIGN_VIEW", "CAMPAIGN_CREATE", "CAMPAIGN_SEND",
    "CAMPAIGN_CANCEL", "CAMPAIGN_ANALYTICS_VIEW", "TEMPLATE_VIEW", "TEMPLATE_SYNC",
    "TEMPLATE_CREATE", "WALLET_VIEW", "BILLING_VIEW", "DEVELOPER_VIEW",
    "DEVELOPER_API_KEYS_MANAGE", "DEVELOPER_WEBHOOKS_MANAGE", "WHATSAPP_SETTINGS_VIEW",
    "WHATSAPP_SETTINGS_MANAGE", "TEAM_VIEW", "TEAM_INVITE", "TEAM_MANAGE_ROLES", "SYSTEM_HEALTH_VIEW",
    "COMPLIANCE_VIEW", "PRIVACY_REQUEST_VIEW", "TRUST_CENTER_VIEW",
    ...AUTOMATION_ADMIN_PERMISSIONS,
  ),
  manager: permissions(
    "DASHBOARD_VIEW", "INBOX_VIEW", "INBOX_REPLY", "INBOX_ASSIGN", "INBOX_CLOSE",
    "CONTACT_VIEW", "CONTACT_CREATE", "CONTACT_UPDATE", "CAMPAIGN_VIEW",
    "CAMPAIGN_CREATE", "CAMPAIGN_SEND", "CAMPAIGN_ANALYTICS_VIEW", "TEMPLATE_VIEW",
    "WALLET_VIEW",
    ...AUTOMATION_MANAGER_PERMISSIONS,
  ),
  member: permissions(
    "DASHBOARD_VIEW", "INBOX_VIEW", "INBOX_REPLY", "CONTACT_VIEW", "CAMPAIGN_VIEW",
    "TEMPLATE_VIEW",
    ...AUTOMATION_MANAGER_PERMISSIONS,
  ),
  readonly: permissions(
    "DASHBOARD_VIEW", "INBOX_VIEW", "CONTACT_VIEW", "CAMPAIGN_VIEW",
    "CAMPAIGN_ANALYTICS_VIEW", "TEMPLATE_VIEW", "BILLING_VIEW",
    ...AUTOMATION_VIEWER_PERMISSIONS,
  ),
};

export async function seedCompanySystemRoles({ companyId }: { companyId: string }) {
  const results = [];

  for (const [slug, rolePermissions] of Object.entries(SYSTEM_ROLE_PERMISSIONS)) {
    results.push(
      await prisma.companyAccessRole.upsert({
        where: { companyId_slug: { companyId, slug } },
        create: {
          companyId,
          slug,
          name: slug.charAt(0).toUpperCase() + slug.slice(1),
          description: `System ${slug} role`,
          isSystem: true,
          permissions: rolePermissions,
          status: "ACTIVE",
        },
        update: {
          isSystem: true,
          permissions: rolePermissions,
          status: "ACTIVE",
        },
      }),
    );
  }

  return results;
}

function systemSlugForLegacyRole(role: CompanyRole) {
  if (role === "OWNER") return "owner";
  if (role === "ADMIN") return "admin";
  return process.env.RBAC_V2_DEFAULT_MEMBER_ROLE || "member";
}

export async function ensureCompanyUserAccessRole({
  companyId,
  userId,
  legacyRole,
}: {
  companyId: string;
  userId: string;
  legacyRole: CompanyRole;
}) {
  await seedCompanySystemRoles({ companyId });
  const role = await prisma.companyAccessRole.findUnique({
    where: {
      companyId_slug: { companyId, slug: systemSlugForLegacyRole(legacyRole) },
    },
  });
  if (!role) throw new Error("Default access role not found");

  return prisma.companyAccessRoleAssignment.upsert({
    where: { companyId_userId: { companyId, userId } },
    create: { companyId, userId, roleId: role.id },
    update: { roleId: role.id, assignedAt: new Date() },
  });
}

export async function seedAllCompanySystemRoles() {
  const companies = await prisma.company.findMany({
    include: { users: true },
  });
  let roleCount = 0;
  let assignmentCount = 0;

  for (const company of companies) {
    const roles = await seedCompanySystemRoles({ companyId: company.id });
    roleCount += roles.length;
    const rolesBySlug = new Map(roles.map((role) => [role.slug, role]));

    for (const companyUser of company.users) {
      const targetRole = rolesBySlug.get(systemSlugForLegacyRole(companyUser.role));
      if (!targetRole) continue;

      await prisma.companyAccessRoleAssignment.upsert({
        where: {
          companyId_userId: { companyId: company.id, userId: companyUser.userId },
        },
        create: {
          companyId: company.id,
          userId: companyUser.userId,
          roleId: targetRole.id,
        },
        update: { roleId: targetRole.id, assignedAt: new Date() },
      });
      assignmentCount += 1;
    }
  }

  return { companies: companies.length, roles: roleCount, assignments: assignmentCount };
}

export async function getUserPermissions({
  companyId,
  userId,
}: {
  companyId: string;
  userId: string;
}) {
  if (!isRbacV2Enabled()) {
    return new Set<RbacPermission>(Object.values(RbacPermission));
  }

  const assignment = await prisma.companyAccessRoleAssignment.findUnique({
    where: { companyId_userId: { companyId, userId } },
    include: { role: true },
  });

  if (!assignment || assignment.role.status !== "ACTIVE") {
    if (isRbacStrictMode()) return new Set<RbacPermission>();

    const fallbackRole = await prisma.companyAccessRole.findUnique({
      where: {
        companyId_slug: {
          companyId,
          slug: process.env.RBAC_V2_DEFAULT_MEMBER_ROLE || "member",
        },
      },
    });
    return new Set(fallbackRole?.permissions ?? []);
  }

  return new Set(assignment.role.permissions);
}

export async function assertUserPermission({
  companyId,
  userId,
  permission,
}: {
  companyId: string;
  userId: string;
  permission: RbacPermission;
}) {
  const userPermissions = await getUserPermissions({ companyId, userId });
  if (!userPermissions.has(permission)) throw new PermissionDeniedError(permission);
}

export async function listCompanyRoles({ companyId }: { companyId: string }) {
  await seedCompanySystemRoles({ companyId });
  return prisma.companyAccessRole.findMany({
    where: { companyId },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    include: { _count: { select: { assignments: true } } },
  });
}

export async function createCompanyRole({
  companyId,
  name,
  slug,
  description,
  permissions: rolePermissions,
}: {
  companyId: string;
  name: string;
  slug: string;
  description?: string | null;
  permissions: RbacPermission[];
}) {
  return prisma.companyAccessRole.create({
    data: {
      companyId,
      name,
      slug,
      description: description ?? null,
      permissions: rolePermissions,
      isSystem: false,
      status: "ACTIVE",
    },
  });
}

export async function assignUserRole({
  companyId,
  userId,
  roleId,
  assignedByUserId,
}: {
  companyId: string;
  userId: string;
  roleId: string;
  assignedByUserId?: string | null;
}) {
  const [role, membership] = await Promise.all([
    prisma.companyAccessRole.findFirst({
      where: { id: roleId, companyId, status: "ACTIVE" },
    }),
    prisma.companyUser.findFirst({
      where: { companyId, userId },
      select: { id: true },
    }),
  ]);

  if (!role) throw new Error("Role not found");
  if (!membership) throw new Error("Team member not found");
  if (
    userId === assignedByUserId &&
    !role.permissions.includes("TEAM_MANAGE_ROLES")
  ) {
    throw new Error("You cannot remove your own role-management permission");
  }

  return prisma.companyAccessRoleAssignment.upsert({
    where: { companyId_userId: { companyId, userId } },
    create: {
      companyId,
      userId,
      roleId,
      assignedByUserId: assignedByUserId ?? null,
    },
    update: {
      roleId,
      assignedByUserId: assignedByUserId ?? null,
      assignedAt: new Date(),
    },
  });
}

export async function getRbacV2Health() {
  const [roles, assignments, companiesWithoutRoles] = await Promise.all([
    prisma.companyAccessRole.count(),
    prisma.companyAccessRoleAssignment.count(),
    prisma.company.count({ where: { accessRoles: { none: {} } } }),
  ]);

  return {
    enabled: isRbacV2Enabled(),
    strictMode: isRbacStrictMode(),
    roles,
    assignments,
    companiesWithoutRoles,
    isHealthy: isRbacV2Enabled() && companiesWithoutRoles === 0,
  };
}
