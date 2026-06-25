import { prisma } from "@/lib/prisma";
import { revalidateCompanyMembersCache } from "@/server/services/team.service";
import { UpdateCompanyInput } from "@/server/validators/company.validator";
import { ensureCompanyUserAccessRole } from "@/server/services/rbac-v2.service";

export async function getUserCompany(userId: string) {
  const membership = await prisma.companyUser.findFirst({
    where: {
      userId,
    },
    include: {
      company: true,
    },
  });

  return membership;
}

export async function createCompanyForUser(userId: string, companyName: string) {
  const existingMembership = await prisma.companyUser.findFirst({
    where: {
      userId,
    },
  });

  if (existingMembership) {
    throw new Error("User already belongs to a company");
  }

  const company = await prisma.company.create({
    data: {
      name: companyName,
      users: {
        create: {
          userId,
          role: "OWNER",
        },
      },
    },
  });

  await prisma.userWorkspacePreference.upsert({
    where: {
      userId,
    },
    create: {
      userId,
      activeCompanyId: company.id,
      lastSelectedAt: new Date(),
    },
    update: {
      activeCompanyId: company.id,
      lastSelectedAt: new Date(),
    },
  });

  await ensureCompanyUserAccessRole({
    companyId: company.id,
    userId,
    legacyRole: "OWNER",
  });

  revalidateCompanyMembersCache();

  return company;
}

export async function updateCompany(
  companyId: string,
  input: UpdateCompanyInput,
) {
  const company = await prisma.company.update({
    where: {
      id: companyId,
    },
    data: {
      name: input.name,
    },
  });

  return company;
}
