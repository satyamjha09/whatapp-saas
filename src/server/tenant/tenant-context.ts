import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformAdminEmails, isPlatformAdminEnabled } from "@/server/auth/platform-admin";
import { getUserByClerkId } from "@/server/services/auth.service";
import { assertCompanyHasActivePlan } from "@/server/services/company-plan-assignment.service";
import {
  getActivePartnerClientAccessSession,
  PARTNER_ACCESS_SESSION_COOKIE,
} from "@/server/services/partner-client-access.service";
import { createPlatformAuditLog } from "@/server/services/platform-audit.service";
import {
  getPlatformPermissionsForRole,
  isPlatformBootstrapEnabled,
  roleHasPlatformPermission,
  type PlatformPermission,
} from "@/server/tenant/platform-permissions";
import {
  canAccessPlatform,
  isCompanyAdmin,
  isCompanyOwner,
  isPlatformAdmin,
  isPlatformSuperAdmin,
} from "./tenant-rules";

export class TenantAccessError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "TenantAccessError";
    this.status = status;
  }
}

export async function getCurrentAppUser() {
  const session = await auth();

  if (!session.userId) {
    throw new TenantAccessError("Authentication required.", 401);
  }

  const user = await getUserByClerkId(session.userId);

  if (!user) {
    throw new TenantAccessError("User profile has not been synced yet.", 403);
  }

  return user;
}

function isConfiguredPlatformAdminEmail(email: string) {
  if (!isPlatformAdminEnabled() || !isPlatformBootstrapEnabled()) return false;

  return getPlatformAdminEmails().includes(email.toLowerCase());
}

export async function requirePlatformUser() {
  const user = await getCurrentAppUser();

  const hasDatabaseAccess =
    user.platformAccessEnabled && canAccessPlatform(user.platformRole);
  const hasConfiguredEmailAccess = isConfiguredPlatformAdminEmail(user.email);

  if (!hasDatabaseAccess && !hasConfiguredEmailAccess) {
    throw new TenantAccessError("Platform access required.", 403);
  }

  const effectiveRole = hasConfiguredEmailAccess ? "SUPER_ADMIN" : user.platformRole;
  const permissions = getPlatformPermissionsForRole(effectiveRole);

  return {
    user,
    platformRole: effectiveRole,
    permissions,
    isPlatformAdmin: isPlatformAdmin(effectiveRole),
    isPlatformSuperAdmin: isPlatformSuperAdmin(effectiveRole),
  };
}

export async function requirePlatformAdmin() {
  const context = await requirePlatformUser();

  if (!context.isPlatformAdmin) {
    throw new TenantAccessError("Platform admin access required.", 403);
  }

  return context;
}

export async function requirePlatformPermission(permission: PlatformPermission) {
  const context = await requirePlatformUser();

  if (!roleHasPlatformPermission(context.platformRole, permission)) {
    await createPlatformAuditLog({
      actorUserId: context.user.id,
      actorEmail: context.user.email,
      action: "platform.permission.denied",
      entityType: "PlatformPermission",
      entityId: permission,
      metadata: {
        role: context.platformRole,
        permission,
      },
    }).catch(() => undefined);

    throw new TenantAccessError("Platform permission required.", 403);
  }

  return context;
}

export async function requirePlatformSuperAdmin() {
  const context = await requirePlatformUser();

  if (!context.isPlatformSuperAdmin) {
    await createPlatformAuditLog({
      actorUserId: context.user.id,
      actorEmail: context.user.email,
      action: "platform.super_admin.denied",
      entityType: "PlatformRole",
      entityId: "SUPER_ADMIN",
      metadata: {
        role: context.platformRole,
      },
    }).catch(() => undefined);

    throw new TenantAccessError("Platform super admin access required.", 403);
  }

  return context;
}

export async function requireCompanyContext(companyId?: string | null) {
  const user = await getCurrentAppUser();
  const workspacePreference = !companyId
    ? await prisma.userWorkspacePreference.findUnique({
        where: {
          userId: user.id,
        },
      })
    : null;
  const targetCompanyId = companyId ?? workspacePreference?.activeCompanyId ?? null;

  const membership = await prisma.companyUser.findFirst({
    where: {
      userId: user.id,
      ...(targetCompanyId ? { companyId: targetCompanyId } : {}),
    },
    include: {
      company: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  let resolvedMembership = membership;
  let partnerAccessSession:
    | Awaited<ReturnType<typeof getActivePartnerClientAccessSession>>
    | null = null;

  if (!resolvedMembership) {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(PARTNER_ACCESS_SESSION_COOKIE)?.value;
    partnerAccessSession = await getActivePartnerClientAccessSession({
      userId: user.id,
      sessionId,
      clientCompanyId: targetCompanyId,
    });

    if (partnerAccessSession) {
      resolvedMembership = {
        id: `partner-access:${partnerAccessSession.id}`,
        userId: user.id,
        companyId: partnerAccessSession.clientCompanyId,
        role: "MEMBER" as const,
        createdAt: partnerAccessSession.startedAt,
        company: partnerAccessSession.clientCompany,
      };
    }
  }

  if (!resolvedMembership) {
    throw new TenantAccessError("Company workspace access required.", 403);
  }

  if (
    resolvedMembership.company.status !== "ACTIVE" &&
    resolvedMembership.company.status !== "PENDING_ONBOARDING"
  ) {
    throw new TenantAccessError("This company workspace is not active.", 403);
  }

  if (resolvedMembership.company.status === "ACTIVE") {
    try {
      await assertCompanyHasActivePlan(resolvedMembership.company.id);
    } catch (error) {
      if (error instanceof Error) {
        throw new TenantAccessError(error.message, 402);
      }

      throw error;
    }
  }

  return {
    user,
    membership: resolvedMembership,
    company: resolvedMembership.company,
    companyId: resolvedMembership.companyId,
    partnerAccessSession,
    isCompanyAdmin: !partnerAccessSession && isCompanyAdmin(resolvedMembership.role),
    isCompanyOwner: !partnerAccessSession && isCompanyOwner(resolvedMembership.role),
  };
}

export async function requireCompanyAdmin(companyId?: string | null) {
  const context = await requireCompanyContext(companyId);

  if (!context.isCompanyAdmin) {
    throw new TenantAccessError("Company admin access required.", 403);
  }

  return context;
}

export async function requireCompanyOwner(companyId?: string | null) {
  const context = await requireCompanyContext(companyId);

  if (!context.isCompanyOwner) {
    throw new TenantAccessError("Company owner access required.", 403);
  }

  return context;
}

export async function assertCompanyDataAccess({
  userId,
  companyId,
}: {
  userId: string;
  companyId: string;
}) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (user?.platformAccessEnabled && isPlatformAdmin(user.platformRole)) {
    return true;
  }

  const membership = await prisma.companyUser.findFirst({
    where: {
      userId,
      companyId,
    },
  });

  if (!membership) {
    const partnerAccessSession = await getActivePartnerClientAccessSession({
      userId,
      clientCompanyId: companyId,
    });

    if (!partnerAccessSession) {
      throw new TenantAccessError("You do not have access to this company.", 403);
    }
  }

  return true;
}
