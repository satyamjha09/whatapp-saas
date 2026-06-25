import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";

export class PlatformCompanyControlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlatformCompanyControlError";
  }
}

function enabled() {
  return process.env.PLATFORM_COMPANY_CONTROL_ENABLED !== "false";
}

function notesEnabled() {
  return process.env.PLATFORM_COMPANY_INTERNAL_NOTES_ENABLED !== "false";
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

async function logPlatformCompanyAction({
  actorUserId,
  companyId,
  description,
  metadata,
  title,
  type,
}: {
  companyId: string;
  actorUserId: string;
  type:
    | "VIEWED"
    | "APPROVED"
    | "ACTIVATED"
    | "SUSPENDED"
    | "REACTIVATED"
    | "DISABLED"
    | "NOTE_ADDED"
    | "NOTE_UPDATED";
  title: string;
  description?: string | null;
  metadata?: unknown;
}) {
  const log = await prisma.platformCompanyActionLog.create({
    data: {
      companyId,
      actorUserId,
      type,
      title,
      description: description ?? null,
      metadata: metadata ? safeJson(metadata) : undefined,
    },
  });

  await createAuditLog({
    companyId,
    actorUserId,
    action: `platform.company.${type.toLowerCase()}`,
    entityType: "Company",
    entityId: companyId,
    metadata: safeJson({
      title,
      description,
      metadata,
    }),
  }).catch(() => undefined);

  return log;
}

export async function getPlatformCompaniesDashboard() {
  if (!enabled()) {
    throw new PlatformCompanyControlError(
      "Platform company control is disabled.",
    );
  }

  const [companies, counts] = await Promise.all([
    prisma.company.findMany({
      include: {
        parentCompany: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        childCompanies: {
          select: {
            id: true,
            name: true,
            status: true,
            type: true,
          },
        },
        users: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                mobile: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        whatsAppAccounts: {
          select: {
            id: true,
            wabaId: true,
            businessName: true,
            status: true,
            createdAt: true,
          },
          take: 1,
          orderBy: {
            createdAt: "desc",
          },
        },
        whatsAppPhoneNumbers: {
          select: {
            id: true,
            phoneNumberId: true,
            displayPhoneNumber: true,
          },
          take: 1,
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 300,
    }),
    prisma.company.groupBy({
      by: ["status"],
      _count: {
        id: true,
      },
    }),
  ]);

  return {
    companies,
    counts: Object.fromEntries(
      counts.map((item) => [item.status, item._count.id]),
    ) as Record<string, number>,
  };
}

export async function getPlatformCompanyDetail({
  actorUserId,
  companyId,
}: {
  companyId: string;
  actorUserId: string;
}) {
  if (!enabled()) {
    throw new PlatformCompanyControlError(
      "Platform company control is disabled.",
    );
  }

  const company = await prisma.company.findUnique({
    where: {
      id: companyId,
    },
    include: {
      parentCompany: {
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
        },
      },
      childCompanies: {
        orderBy: {
          createdAt: "desc",
        },
      },
      users: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              mobile: true,
              imageUrl: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      whatsAppAccounts: {
        orderBy: {
          createdAt: "desc",
        },
        include: {
          phoneNumbers: true,
        },
      },
      whatsAppPhoneNumbers: {
        orderBy: {
          createdAt: "desc",
        },
      },
      wallet: true,
      billingProfile: true,
      platformCompanyNotes: {
        include: {
          createdByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      platformCompanyActionLogs: {
        include: {
          actorUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 50,
      },
    },
  });

  if (!company) {
    throw new PlatformCompanyControlError("Company not found.");
  }

  await logPlatformCompanyAction({
    companyId,
    actorUserId,
    type: "VIEWED",
    title: "Company viewed by platform admin",
  }).catch(() => undefined);

  return company;
}

export async function activatePlatformCompany({
  actorUserId,
  companyId,
}: {
  companyId: string;
  actorUserId: string;
}) {
  const company = await prisma.company.update({
    where: {
      id: companyId,
    },
    data: {
      status: "ACTIVE",
      suspendedAt: null,
      suspensionReason: null,
      onboardingCompletedAt: new Date(),
    },
  });

  await logPlatformCompanyAction({
    companyId,
    actorUserId,
    type: "ACTIVATED",
    title: "Company activated",
    metadata: {
      status: company.status,
    },
  });

  return company;
}

export async function suspendPlatformCompany({
  actorUserId,
  companyId,
  reason,
}: {
  companyId: string;
  actorUserId: string;
  reason: string;
}) {
  if (!reason.trim()) {
    throw new PlatformCompanyControlError("Suspension reason is required.");
  }

  const company = await prisma.company.update({
    where: {
      id: companyId,
    },
    data: {
      status: "SUSPENDED",
      suspendedAt: new Date(),
      suspensionReason: reason.trim(),
    },
  });

  await logPlatformCompanyAction({
    companyId,
    actorUserId,
    type: "SUSPENDED",
    title: "Company suspended",
    description: reason.trim(),
  });

  return company;
}

export async function reactivatePlatformCompany({
  actorUserId,
  companyId,
}: {
  companyId: string;
  actorUserId: string;
}) {
  const company = await prisma.company.update({
    where: {
      id: companyId,
    },
    data: {
      status: "ACTIVE",
      suspendedAt: null,
      suspensionReason: null,
    },
  });

  await logPlatformCompanyAction({
    companyId,
    actorUserId,
    type: "REACTIVATED",
    title: "Company reactivated",
  });

  return company;
}

export async function disablePlatformCompany({
  actorUserId,
  companyId,
  reason,
}: {
  companyId: string;
  actorUserId: string;
  reason: string;
}) {
  if (!reason.trim()) {
    throw new PlatformCompanyControlError("Disable reason is required.");
  }

  const company = await prisma.company.update({
    where: {
      id: companyId,
    },
    data: {
      status: "DISABLED",
      suspendedAt: new Date(),
      suspensionReason: reason.trim(),
    },
  });

  await logPlatformCompanyAction({
    companyId,
    actorUserId,
    type: "DISABLED",
    title: "Company disabled",
    description: reason.trim(),
  });

  return company;
}

export async function addPlatformCompanyNote({
  actorUserId,
  body,
  companyId,
  title,
  visibility,
}: {
  companyId: string;
  actorUserId: string;
  title: string;
  body: string;
  visibility: "INTERNAL" | "SUPPORT" | "FINANCE";
}) {
  if (!notesEnabled()) {
    throw new PlatformCompanyControlError("Platform notes are disabled.");
  }

  if (!title.trim()) {
    throw new PlatformCompanyControlError("Note title is required.");
  }

  if (!body.trim()) {
    throw new PlatformCompanyControlError("Note body is required.");
  }

  const note = await prisma.platformCompanyNote.create({
    data: {
      companyId,
      createdByUserId: actorUserId,
      title: title.trim(),
      body: body.trim(),
      visibility,
    },
  });

  await logPlatformCompanyAction({
    companyId,
    actorUserId,
    type: "NOTE_ADDED",
    title: "Platform note added",
    description: note.title,
    metadata: {
      noteId: note.id,
      visibility,
    },
  });

  return note;
}

export async function getPlatformCompanyControlHealth() {
  const [totalCompanies, suspendedCompanies, disabledCompanies, notes] =
    await Promise.all([
      prisma.company.count(),
      prisma.company.count({
        where: {
          status: "SUSPENDED",
        },
      }),
      prisma.company.count({
        where: {
          status: "DISABLED",
        },
      }),
      prisma.platformCompanyNote.count().catch(() => 0),
    ]);

  return {
    enabled: enabled(),
    notesEnabled: notesEnabled(),
    totalCompanies,
    suspendedCompanies,
    disabledCompanies,
    notes,
    isHealthy: enabled(),
  };
}
