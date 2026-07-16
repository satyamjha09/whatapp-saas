import type { PlatformRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createPlatformAuditLog } from "@/server/services/platform-audit.service";

export class PlatformUserManagementError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PlatformUserManagementError";
    this.status = status;
  }
}

const ROLE_ORDER: Record<PlatformRole, number> = {
  NONE: 0,
  SUPPORT: 10,
  FINANCE: 20,
  ADMIN: 80,
  SUPER_ADMIN: 100,
};

export async function getPlatformUsersDashboard() {
  const users = await prisma.user.findMany({
    orderBy: [
      {
        platformAccessEnabled: "desc",
      },
      {
        platformRole: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
    select: {
      id: true,
      email: true,
      name: true,
      mobile: true,
      imageUrl: true,
      platformAccessEnabled: true,
      platformRole: true,
      createdAt: true,
      updatedAt: true,
      companies: {
        select: {
          role: true,
          company: {
            select: {
              id: true,
              name: true,
              status: true,
              type: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 3,
      },
    },
  });

  const counts = users.reduce(
    (acc, user) => {
      acc.total += 1;

      if (user.platformAccessEnabled) {
        acc.platformEnabled += 1;
      }

      acc.roles[user.platformRole] = (acc.roles[user.platformRole] ?? 0) + 1;

      return acc;
    },
    {
      total: 0,
      platformEnabled: 0,
      roles: {} as Record<PlatformRole, number>,
    },
  );

  return {
    counts,
    users: users.sort((left, right) => {
      const roleDelta = ROLE_ORDER[right.platformRole] - ROLE_ORDER[left.platformRole];
      if (roleDelta !== 0) return roleDelta;

      if (left.platformAccessEnabled !== right.platformAccessEnabled) {
        return left.platformAccessEnabled ? -1 : 1;
      }

      return left.email.localeCompare(right.email);
    }),
  };
}

export async function updatePlatformUserAccess({
  actorEmail,
  actorUserId,
  platformAccessEnabled,
  platformRole,
  targetUserId,
}: {
  actorEmail: string;
  actorUserId: string;
  platformAccessEnabled: boolean;
  platformRole: PlatformRole;
  targetUserId: string;
}) {
  const target = await prisma.user.findUnique({
    where: {
      id: targetUserId,
    },
    select: {
      id: true,
      email: true,
      platformAccessEnabled: true,
      platformRole: true,
    },
  });

  if (!target) {
    throw new PlatformUserManagementError("User not found.", 404);
  }

  const nextRole = platformAccessEnabled ? platformRole : "NONE";
  const removesSuperAdmin =
    target.platformAccessEnabled &&
    target.platformRole === "SUPER_ADMIN" &&
    (!platformAccessEnabled || nextRole !== "SUPER_ADMIN");

  if (removesSuperAdmin) {
    const remainingSuperAdmins = await prisma.user.count({
      where: {
        id: {
          not: target.id,
        },
        platformAccessEnabled: true,
        platformRole: "SUPER_ADMIN",
      },
    });

    if (remainingSuperAdmins === 0) {
      throw new PlatformUserManagementError(
        "At least one platform super admin must remain.",
        409,
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: {
        id: target.id,
      },
      data: {
        platformAccessEnabled,
        platformRole: nextRole,
      },
      select: {
        id: true,
        email: true,
        name: true,
        platformAccessEnabled: true,
        platformRole: true,
        updatedAt: true,
      },
    });

    await createPlatformAuditLog({
      actorEmail,
      actorUserId,
      action: "platform_user.access_updated",
      entityType: "User",
      entityId: target.id,
      metadata: {
        targetEmail: target.email,
        previous: {
          platformAccessEnabled: target.platformAccessEnabled,
          platformRole: target.platformRole,
        },
        next: {
          platformAccessEnabled,
          platformRole: nextRole,
        },
      },
    });

    return user;
  });

  return updated;
}
