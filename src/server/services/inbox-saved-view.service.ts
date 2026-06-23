import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export async function listInboxSavedViews({
  companyId,
  userId,
}: {
  companyId: string;
  userId: string;
}) {
  return prisma.inboxSavedView.findMany({
    where: {
      companyId,
      OR: [
        {
          visibility: "COMPANY",
        },
        {
          visibility: "PRIVATE",
          userId,
        },
      ],
    },
    orderBy: [
      {
        isDefault: "desc",
      },
      {
        updatedAt: "desc",
      },
    ],
  });
}

export async function createInboxSavedView({
  companyId,
  userId,
  name,
  visibility,
  filters,
  sortBy,
  isDefault,
}: {
  companyId: string;
  userId: string;
  name: string;
  visibility: "PRIVATE" | "COMPANY";
  filters: unknown;
  sortBy?: string;
  isDefault?: boolean;
}) {
  return prisma.inboxSavedView.create({
    data: {
      companyId,
      userId,
      name,
      visibility,
      filters: filters as Prisma.InputJsonValue,
      sortBy: sortBy ?? "recent",
      isDefault: Boolean(isDefault),
    },
  });
}

export async function deleteInboxSavedView({
  companyId,
  userId,
  savedViewId,
}: {
  companyId: string;
  userId: string;
  savedViewId: string;
}) {
  return prisma.inboxSavedView.deleteMany({
    where: {
      id: savedViewId,
      companyId,
      OR: [
        {
          userId,
        },
        {
          visibility: "COMPANY",
        },
      ],
    },
  });
}
