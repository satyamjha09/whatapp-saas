import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { backfillCompanyNotificationRecipients } from "@/server/services/company-notification.service";
import { ensureCompanyNotificationPreferences } from "@/server/services/company-notification-preference.service";
import { UpdateMemberRoleInput } from "@/server/validators/team.validator";

type UpdateCompanyMemberRoleInput = {
  companyId: string;
  companyUserId: string;
  currentUserId: string;
  input: UpdateMemberRoleInput;
};

type RemoveCompanyMemberInput = {
  companyId: string;
  companyUserId: string;
  currentUserId: string;
};

export const COMPANY_MEMBERS_CACHE_TAG = "company-members";

export function revalidateCompanyMembersCache() {
  revalidateTag(COMPANY_MEMBERS_CACHE_TAG, "max");
}

export const getCompanyMembers = unstable_cache(
  async function getCompanyMembers(companyId: string) {
  return prisma.companyUser.findMany({
    where: {
      companyId,
    },
    include: {
      user: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
  },
  ["company-members-by-company"],
  {
    revalidate: 60,
    tags: [COMPANY_MEMBERS_CACHE_TAG],
  },
);

export async function updateCompanyMemberRole({
  companyId,
  companyUserId,
  currentUserId,
  input,
}: UpdateCompanyMemberRoleInput) {
  const member = await prisma.companyUser.findFirst({
    where: {
      id: companyUserId,
      companyId,
    },
  });

  if (!member) {
    throw new Error("Team member not found");
  }

  if (member.userId === currentUserId) {
    throw new Error("You cannot change your own role");
  }

  if (member.role === "OWNER" && input.role !== "OWNER") {
    const ownerCount = await prisma.companyUser.count({
      where: {
        companyId,
        role: "OWNER",
      },
    });

    if (ownerCount <= 1) {
      throw new Error("Company must have at least one owner");
    }
  }

  const updatedMember = await prisma.companyUser.update({
    where: {
      id: companyUserId,
    },
    data: {
      role: input.role,
    },
    include: {
      user: true,
    },
  });

  revalidateCompanyMembersCache();

  if (updatedMember.role === "OWNER" || updatedMember.role === "ADMIN") {
    await ensureCompanyNotificationPreferences({
      companyId,
      userId: updatedMember.userId,
    });
    await backfillCompanyNotificationRecipients(companyId);
  }

  return updatedMember;
}

export async function removeCompanyMember({
  companyId,
  companyUserId,
  currentUserId,
}: RemoveCompanyMemberInput) {
  const member = await prisma.companyUser.findFirst({
    where: {
      id: companyUserId,
      companyId,
    },
    include: {
      user: true,
    },
  });

  if (!member) {
    throw new Error("Team member not found");
  }

  if (member.userId === currentUserId) {
    throw new Error("You cannot remove yourself");
  }

  if (member.role === "OWNER") {
    const ownerCount = await prisma.companyUser.count({
      where: {
        companyId,
        role: "OWNER",
      },
    });

    if (ownerCount <= 1) {
      throw new Error("Company must have at least one owner");
    }
  }

  await prisma.companyUser.delete({
    where: {
      id: member.id,
    },
  });

  revalidateCompanyMembersCache();

  return member;
}
