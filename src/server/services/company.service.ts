import { prisma } from "@/lib/prisma";

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

  return company;
}
