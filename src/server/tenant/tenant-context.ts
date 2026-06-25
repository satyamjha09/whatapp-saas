import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getPlatformAdminEmails, isPlatformAdminEnabled } from "@/server/auth/platform-admin";
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

function primaryEmail(clerkUser: Awaited<ReturnType<typeof currentUser>>) {
  return (
    clerkUser?.emailAddresses?.find(
      (item) => item.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress ?? clerkUser?.emailAddresses?.[0]?.emailAddress
  );
}

export async function getCurrentAppUser() {
  const session = await auth();

  if (!session.userId) {
    throw new TenantAccessError("Authentication required.", 401);
  }

  const clerkUser = await currentUser();
  const email = primaryEmail(clerkUser);

  const user = await prisma.user.upsert({
    where: {
      clerkUserId: session.userId,
    },
    create: {
      clerkUserId: session.userId,
      email: email ?? `${session.userId}@unknown.local`,
      name: clerkUser?.fullName ?? clerkUser?.firstName ?? null,
      imageUrl: clerkUser?.imageUrl ?? null,
    },
    update: {
      email: email ?? undefined,
      name: clerkUser?.fullName ?? clerkUser?.firstName ?? undefined,
      imageUrl: clerkUser?.imageUrl ?? undefined,
    },
  });

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

  const membership = await prisma.companyUser.findUnique({
    where: {
      userId_companyId: {
        userId,
        companyId,
      },
    },
  });

  if (!membership) {
    throw new TenantAccessError("You do not have access to this company.", 403);
  }

  return true;
}
