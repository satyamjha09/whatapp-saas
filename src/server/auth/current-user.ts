import { currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getUserByClerkId } from "@/server/services/auth.service";
import {
  getActivePartnerClientAccessSession,
  PARTNER_ACCESS_SESSION_COOKIE,
} from "@/server/services/partner-client-access.service";

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

  let membership = preferredMembership;
  let partnerAccessSession:
    | Awaited<ReturnType<typeof getActivePartnerClientAccessSession>>
    | null = null;

  if (!preferredMembership && preference?.activeCompanyId) {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(PARTNER_ACCESS_SESSION_COOKIE)?.value;
    partnerAccessSession = await getActivePartnerClientAccessSession({
      userId: user.id,
      sessionId,
      clientCompanyId: preference?.activeCompanyId,
    });

    if (partnerAccessSession) {
      membership = {
        id: `partner-access:${partnerAccessSession.id}`,
        userId: user.id,
        companyId: partnerAccessSession.clientCompanyId,
        role: "MEMBER" as const,
        createdAt: partnerAccessSession.startedAt,
        company: partnerAccessSession.clientCompany,
      };
    }
  }

  if (!membership) {
    membership = await prisma.companyUser.findFirst({
      where: {
        userId: user.id,
      },
      include: {
        company: true,
      },
    });
  }

  return {
    user,
    membership,
    partnerAccessSession,
  };
});
