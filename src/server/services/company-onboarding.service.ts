import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit.service";
import { ensureCompanyUserAccessRole } from "@/server/services/rbac-v2.service";

export class CompanyOnboardingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompanyOnboardingError";
  }
}

export async function createCompanyWorkspace({
  ownerUserId,
  name,
  type = "DIRECT_COMPANY",
  parentCompanyId,
  legalName,
  website,
  industry,
}: {
  ownerUserId: string;
  name: string;
  type?: "DIRECT_COMPANY" | "PARTNER" | "PARTNER_CLIENT";
  parentCompanyId?: string | null;
  legalName?: string | null;
  website?: string | null;
  industry?: string | null;
}) {
  if (!name.trim()) {
    throw new CompanyOnboardingError("Company name is required.");
  }

  if (type === "PARTNER_CLIENT" && !parentCompanyId) {
    throw new CompanyOnboardingError(
      "Partner client must have a parent partner company.",
    );
  }

  if (parentCompanyId) {
    const parent = await prisma.company.findUnique({
      where: {
        id: parentCompanyId,
      },
      select: {
        id: true,
        type: true,
      },
    });

    if (!parent || parent.type !== "PARTNER") {
      throw new CompanyOnboardingError("Parent company must be a partner.");
    }
  }

  const company = await prisma.$transaction(async (tx) => {
    const created = await tx.company.create({
      data: {
        name: name.trim(),
        legalName: legalName?.trim() || null,
        website: website?.trim() || null,
        industry: industry?.trim() || null,
        type,
        parentCompanyId: parentCompanyId ?? null,
        billingOwnerType: type === "PARTNER_CLIENT" ? "PARENT_PARTNER" : "SELF",
        status: "PENDING_ONBOARDING",
      },
    });

    await tx.companyUser.create({
      data: {
        companyId: created.id,
        userId: ownerUserId,
        role: "OWNER",
      },
    });

    await tx.userWorkspacePreference.upsert({
      where: {
        userId: ownerUserId,
      },
      create: {
        userId: ownerUserId,
        activeCompanyId: created.id,
        lastSelectedAt: new Date(),
      },
      update: {
        activeCompanyId: created.id,
        lastSelectedAt: new Date(),
      },
    });

    return created;
  });

  await ensureCompanyUserAccessRole({
    companyId: company.id,
    userId: ownerUserId,
    legacyRole: "OWNER",
  }).catch(() => undefined);

  await createAuditLog({
    companyId: company.id,
    actorUserId: ownerUserId,
    action: "company.workspace_created",
    entityType: "Company",
    entityId: company.id,
    metadata: {
      name: company.name,
      type: company.type,
      parentCompanyId: company.parentCompanyId,
    },
  }).catch(() => undefined);

  return company;
}

export async function completeCompanyOnboarding({
  companyId,
  actorUserId,
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
      onboardingCompletedAt: new Date(),
    },
  });

  await createAuditLog({
    companyId,
    actorUserId,
    action: "company.onboarding_completed",
    entityType: "Company",
    entityId: companyId,
    metadata: {
      status: company.status,
    },
  }).catch(() => undefined);

  return company;
}

export async function suspendCompany({
  companyId,
  actorUserId,
  reason,
}: {
  companyId: string;
  actorUserId: string;
  reason: string;
}) {
  const company = await prisma.company.update({
    where: {
      id: companyId,
    },
    data: {
      status: "SUSPENDED",
      suspendedAt: new Date(),
      suspensionReason: reason,
    },
  });

  await createAuditLog({
    companyId,
    actorUserId,
    action: "company.suspended",
    entityType: "Company",
    entityId: companyId,
    metadata: {
      reason,
    },
  }).catch(() => undefined);

  return company;
}

export async function listPlatformCompanies() {
  return prisma.company.findMany({
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
        },
      },
      users: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 200,
  });
}

export async function listUserCompanies(userId: string) {
  return prisma.companyUser.findMany({
    where: {
      userId,
    },
    include: {
      company: {
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
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}
