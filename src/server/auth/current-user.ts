import { currentUser } from "@clerk/nextjs/server";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getUserByClerkId } from "@/server/services/auth.service";

export const getCurrentDatabaseUser = cache(async function getCurrentDatabaseUser() {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    return null;
  }

  return getUserByClerkId(clerkUser.id);
});

export const getCurrentWorkspaceContext = cache(async function getCurrentWorkspaceContext() {
  const user = await getCurrentDatabaseUser();

  if (!user) {
    return null;
  }

  const preference = await prisma.userWorkspacePreference.findUnique({
    where: {
      userId: user.id,
    },
  });

  const preferredMembership = preference?.activeCompanyId
    ? await prisma.companyUser.findFirst({
        where: {
          userId: user.id,
          companyId: preference.activeCompanyId,
        },
        include: {
          company: true,
        },
      })
    : null;

  const fallbackMembership = await prisma.companyUser.findFirst({
    where: {
      userId: user.id,
    },
    include: {
      company: true,
    },
  });
  const membership = preferredMembership ?? fallbackMembership;

  return {
    user,
    membership,
  };
});
