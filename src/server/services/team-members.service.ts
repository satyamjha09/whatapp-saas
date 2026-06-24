import { prisma } from "@/lib/prisma";

export async function listCompanyTeamMembers({ companyId }: { companyId: string }) {
  return prisma.companyUser.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
    include: {
      user: true,
      company: { select: { id: true, name: true } },
    },
  });
}
