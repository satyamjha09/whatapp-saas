import { Prisma, type PartnerClientAccessPermission } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createPlatformAuditLog } from "@/server/services/platform-audit.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";
import type {
  GrantPartnerClientAccessInput,
  StartPartnerClientAccessSessionInput,
} from "@/server/validators/partner-client-access.validator";

export const PARTNER_ACCESS_SESSION_COOKIE = "metawhat_partner_access_session";
const DEFAULT_SESSION_HOURS = 2;

const DEFAULT_PARTNER_CLIENT_ACCESS_PERMISSIONS = [
  "CLIENT_VIEW",
  "CLIENT_SUPPORT",
] as const satisfies readonly PartnerClientAccessPermission[];

export class PartnerClientAccessError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PartnerClientAccessError";
    this.status = status;
  }
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

function uniquePermissions(
  permissions: readonly PartnerClientAccessPermission[] | undefined,
) {
  const values =
    permissions && permissions.length > 0
      ? permissions
      : DEFAULT_PARTNER_CLIENT_ACCESS_PERMISSIONS;

  if (!values.includes("CLIENT_VIEW")) {
    return ["CLIENT_VIEW", ...new Set(values)] as PartnerClientAccessPermission[];
  }

  return [...new Set(values)] as PartnerClientAccessPermission[];
}

export function isPartnerClientGrantUsable({
  active,
  expiresAt,
  permissions,
  requiredPermission = "CLIENT_VIEW",
  revokedAt,
}: {
  active: boolean;
  expiresAt?: Date | string | null;
  permissions: readonly PartnerClientAccessPermission[];
  requiredPermission?: PartnerClientAccessPermission;
  revokedAt?: Date | string | null;
}) {
  if (!active || revokedAt) return false;
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) return false;

  return permissions.includes(requiredPermission);
}

export function isPartnerClientSessionUsable({
  endedAt,
  expiresAt,
  permissions,
  requiredPermission = "CLIENT_VIEW",
}: {
  endedAt?: Date | string | null;
  expiresAt: Date | string;
  permissions: readonly PartnerClientAccessPermission[];
  requiredPermission?: PartnerClientAccessPermission;
}) {
  if (endedAt) return false;
  if (new Date(expiresAt).getTime() <= Date.now()) return false;

  return permissions.includes(requiredPermission);
}

async function getActivePartnerClientRelationship({
  clientCompanyId,
  partnerCompanyId,
}: {
  partnerCompanyId: string;
  clientCompanyId: string;
}) {
  const relationship = await prisma.partnerClientRelationship.findUnique({
    where: {
      partnerCompanyId_clientCompanyId: {
        partnerCompanyId,
        clientCompanyId,
      },
    },
    include: {
      clientCompany: {
        select: {
          id: true,
          name: true,
          status: true,
          type: true,
          parentCompanyId: true,
        },
      },
      partnerCompany: {
        select: {
          id: true,
          name: true,
          status: true,
          type: true,
        },
      },
    },
  });

  if (!relationship) {
    throw new PartnerClientAccessError(
      "Partner-client relationship was not found.",
      404,
    );
  }

  if (relationship.status === "ARCHIVED" || relationship.status === "SUSPENDED") {
    throw new PartnerClientAccessError(
      "Partner-client relationship is not active.",
      403,
    );
  }

  if (
    relationship.partnerCompany.type !== "PARTNER" ||
    relationship.clientCompany.type !== "PARTNER_CLIENT" ||
    relationship.clientCompany.parentCompanyId !== partnerCompanyId
  ) {
    throw new PartnerClientAccessError(
      "Client workspace does not belong to the selected partner.",
      403,
    );
  }

  return relationship;
}

async function assertUserBelongsToPartner({
  partnerCompanyId,
  userId,
}: {
  partnerCompanyId: string;
  userId: string;
}) {
  const membership = await prisma.companyUser.findFirst({
    where: {
      companyId: partnerCompanyId,
      userId,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  if (!membership) {
    throw new PartnerClientAccessError(
      "Only users in the partner workspace can receive client access.",
      403,
    );
  }

  return membership;
}

export async function grantPartnerClientAccess({
  actorUserId,
  actorEmail,
  input,
}: {
  actorUserId: string;
  actorEmail?: string | null;
  input: GrantPartnerClientAccessInput;
}) {
  const relationship = await getActivePartnerClientRelationship({
    partnerCompanyId: input.partnerCompanyId,
    clientCompanyId: input.clientCompanyId,
  });
  const partnerUser = await assertUserBelongsToPartner({
    partnerCompanyId: input.partnerCompanyId,
    userId: input.userId,
  });
  const permissions = uniquePermissions(
    input.permissions as PartnerClientAccessPermission[],
  );
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    throw new PartnerClientAccessError("Grant expiry must be in the future.");
  }

  const grant = await prisma.partnerClientAccessGrant.upsert({
    where: {
      clientCompanyId_userId: {
        clientCompanyId: input.clientCompanyId,
        userId: input.userId,
      },
    },
    create: {
      partnerCompanyId: input.partnerCompanyId,
      clientCompanyId: input.clientCompanyId,
      relationshipId: relationship.id,
      userId: input.userId,
      grantedByUserId: actorUserId,
      permissions,
      expiresAt,
      metadata: safeJson({
        source: "platform_partner_client_access",
      }),
    },
    update: {
      partnerCompanyId: input.partnerCompanyId,
      relationshipId: relationship.id,
      grantedByUserId: actorUserId,
      permissions,
      expiresAt,
      active: true,
      revokedAt: null,
      metadata: safeJson({
        source: "platform_partner_client_access",
        refreshedAt: new Date().toISOString(),
      }),
    },
    include: partnerClientAccessGrantInclude(),
  });

  await createPlatformAuditLog({
    actorUserId,
    actorEmail,
    action: "partner_client_access.granted",
    entityType: "PartnerClientAccessGrant",
    entityId: grant.id,
    metadata: {
      partnerCompanyId: input.partnerCompanyId,
      clientCompanyId: input.clientCompanyId,
      userId: input.userId,
      userEmail: partnerUser.user.email,
      permissions,
      expiresAt,
    },
  }).catch(() => undefined);

  return grant;
}

export async function revokePartnerClientAccess({
  actorUserId,
  actorEmail,
  grantId,
}: {
  actorUserId: string;
  actorEmail?: string | null;
  grantId: string;
}) {
  const grant = await prisma.partnerClientAccessGrant.update({
    where: {
      id: grantId,
    },
    data: {
      active: false,
      revokedAt: new Date(),
    },
    include: partnerClientAccessGrantInclude(),
  });

  await prisma.partnerClientAccessSession.updateMany({
    where: {
      grantId,
      endedAt: null,
    },
    data: {
      endedAt: new Date(),
    },
  });

  await createPlatformAuditLog({
    actorUserId,
    actorEmail,
    action: "partner_client_access.revoked",
    entityType: "PartnerClientAccessGrant",
    entityId: grant.id,
    metadata: {
      partnerCompanyId: grant.partnerCompanyId,
      clientCompanyId: grant.clientCompanyId,
      userId: grant.userId,
    },
  }).catch(() => undefined);

  return grant;
}

export async function startPartnerClientAccessSession({
  actorEmail,
  input,
  ipAddress,
  userAgent,
  userId,
}: {
  userId: string;
  actorEmail?: string | null;
  input: StartPartnerClientAccessSessionInput;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const grant = await prisma.partnerClientAccessGrant.findFirst({
    where: {
      clientCompanyId: input.clientCompanyId,
      userId,
      active: true,
    },
    include: partnerClientAccessGrantInclude(),
  });

  if (
    !grant ||
    !isPartnerClientGrantUsable({
      active: grant.active,
      expiresAt: grant.expiresAt,
      permissions: grant.permissions,
      revokedAt: grant.revokedAt,
    })
  ) {
    throw new PartnerClientAccessError(
      "No active partner access grant exists for this client workspace.",
      403,
    );
  }

  const relationship = await getActivePartnerClientRelationship({
    partnerCompanyId: grant.partnerCompanyId,
    clientCompanyId: grant.clientCompanyId,
  });
  const expiresAt = new Date(Date.now() + DEFAULT_SESSION_HOURS * 60 * 60 * 1000);

  const session = await prisma.$transaction(async (tx) => {
    await tx.partnerClientAccessSession.updateMany({
      where: {
        userId,
        endedAt: null,
      },
      data: {
        endedAt: new Date(),
      },
    });

    const created = await tx.partnerClientAccessSession.create({
      data: {
        partnerCompanyId: grant.partnerCompanyId,
        clientCompanyId: grant.clientCompanyId,
        relationshipId: relationship.id,
        grantId: grant.id,
        userId,
        permissions: grant.permissions,
        reason: input.reason?.trim() || null,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        expiresAt,
        metadata: safeJson({
          source: "platform_partner_client_access",
        }),
      },
      include: partnerClientAccessSessionInclude(),
    });

    await tx.userWorkspacePreference.upsert({
      where: {
        userId,
      },
      create: {
        userId,
        activeCompanyId: grant.clientCompanyId,
        lastSelectedAt: new Date(),
      },
      update: {
        activeCompanyId: grant.clientCompanyId,
        lastSelectedAt: new Date(),
      },
    });

    return created;
  });

  await createPlatformAuditLog({
    actorUserId: userId,
    actorEmail,
    action: "partner_client_access.session_started",
    entityType: "PartnerClientAccessSession",
    entityId: session.id,
    metadata: {
      partnerCompanyId: grant.partnerCompanyId,
      clientCompanyId: grant.clientCompanyId,
      grantId: grant.id,
      expiresAt,
      reason: input.reason,
    },
  }).catch(() => undefined);

  return session;
}

export async function endPartnerClientAccessSession({
  actorEmail,
  sessionId,
  userId,
}: {
  userId: string;
  actorEmail?: string | null;
  sessionId: string;
}) {
  const session = await prisma.partnerClientAccessSession.update({
    where: {
      id: sessionId,
    },
    data: {
      endedAt: new Date(),
    },
    include: partnerClientAccessSessionInclude(),
  });

  if (session.userId !== userId) {
    throw new PartnerClientAccessError("Partner access session not found.", 404);
  }

  await createPlatformAuditLog({
    actorUserId: userId,
    actorEmail,
    action: "partner_client_access.session_ended",
    entityType: "PartnerClientAccessSession",
    entityId: session.id,
    metadata: {
      partnerCompanyId: session.partnerCompanyId,
      clientCompanyId: session.clientCompanyId,
    },
  }).catch(() => undefined);

  return session;
}

export async function getActivePartnerClientAccessSession({
  clientCompanyId,
  sessionId,
  userId,
}: {
  userId: string;
  sessionId?: string | null;
  clientCompanyId?: string | null;
}) {
  if (!sessionId && !clientCompanyId) return null;

  const session = await prisma.partnerClientAccessSession.findFirst({
    where: {
      userId,
      endedAt: null,
      ...(sessionId ? { id: sessionId } : {}),
      ...(clientCompanyId ? { clientCompanyId } : {}),
      expiresAt: {
        gt: new Date(),
      },
    },
    include: partnerClientAccessSessionInclude(),
    orderBy: {
      startedAt: "desc",
    },
  });

  if (
    !session ||
    !isPartnerClientSessionUsable({
      endedAt: session.endedAt,
      expiresAt: session.expiresAt,
      permissions: session.permissions,
    })
  ) {
    return null;
  }

  return session;
}

function partnerClientAccessGrantInclude() {
  return {
    user: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
    grantedByUser: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
    partnerCompany: {
      select: {
        id: true,
        name: true,
        status: true,
        type: true,
      },
    },
    clientCompany: {
      select: {
        id: true,
        name: true,
        status: true,
        type: true,
      },
    },
  };
}

function partnerClientAccessSessionInclude() {
  return {
    partnerCompany: {
      select: {
        id: true,
        name: true,
      },
    },
    clientCompany: true,
    user: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
  };
}

export async function getPartnerClientAccessDashboard() {
  const [partners, activeSessions] = await Promise.all([
    prisma.company.findMany({
      where: {
        type: "PARTNER",
      },
      select: {
        id: true,
        name: true,
        status: true,
        users: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        partnerClientRelationshipsAsPartner: {
          include: {
            clientCompany: {
              select: {
                id: true,
                name: true,
                status: true,
                billingPlan: true,
                createdAt: true,
              },
            },
            accessGrants: {
              include: partnerClientAccessGrantInclude(),
              orderBy: {
                createdAt: "desc",
              },
            },
            accessSessions: {
              where: {
                endedAt: null,
                expiresAt: {
                  gt: new Date(),
                },
              },
              include: partnerClientAccessSessionInclude(),
              orderBy: {
                startedAt: "desc",
              },
              take: 5,
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.partnerClientAccessSession.findMany({
      where: {
        endedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: partnerClientAccessSessionInclude(),
      orderBy: {
        startedAt: "desc",
      },
      take: 20,
    }),
  ]);

  return {
    partners,
    activeSessions,
  };
}
