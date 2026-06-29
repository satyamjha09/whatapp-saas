import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getPlatformAdminEmails, isPlatformAdminEnabled } from "@/server/auth/platform-admin";
import { getUserByClerkId } from "@/server/services/auth.service";
import { assertCompanyHasActivePlan } from "@/server/services/company-plan-assignment.service";
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
  if (!isPlatformAdminEnabled()) return false;

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

  return {
    user,
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

export async function requireCompanyContext(companyId?: string | null) {
  const user = await getCurrentAppUser();

  const membership = await prisma.companyUser.findFirst({
    where: {
      userId: user.id,
      ...(companyId ? { companyId } : {}),
    },
    include: {
      company: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!membership) {
    throw new TenantAccessError("Company workspace access required.", 403);
  }

  if (
    membership.company.status !== "ACTIVE" &&
    membership.company.status !== "PENDING_ONBOARDING"
  ) {
    throw new TenantAccessError("This company workspace is not active.", 403);
  }

  if (membership.company.status === "ACTIVE") {
    try {
      await assertCompanyHasActivePlan(membership.company.id);
    } catch (error) {
      if (error instanceof Error) {
        throw new TenantAccessError(error.message, 402);
      }

      throw error;
    }
  }

  return {
    user,
    membership,
    company: membership.company,
    companyId: membership.companyId,
    isCompanyAdmin: isCompanyAdmin(membership.role),
    isCompanyOwner: isCompanyOwner(membership.role),
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
    throw new TenantAccessError("You do not have access to this company.", 403);
  }

  return true;
}
