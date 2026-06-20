import { currentUser } from "@clerk/nextjs/server";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { syncUser } from "@/server/services/auth.service";

export const getCurrentDatabaseUser = cache(async function getCurrentDatabaseUser() {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    return null;
  }

  const primaryEmail =
    clerkUser.emailAddresses.find(
      (email) => email.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

  if (!primaryEmail) {
    throw new Error("Authenticated user has no email address");
  }

  const user = await syncUser({
    clerkUserId: clerkUser.id,
    email: primaryEmail,
    name: clerkUser.fullName,
    imageUrl: clerkUser.imageUrl,
  });

  return user;
});

export const getCurrentWorkspaceContext = cache(async function getCurrentWorkspaceContext() {
  const user = await getCurrentDatabaseUser();

  if (!user) {
    return null;
  }

  const membership = await prisma.companyUser.findFirst({
    where: {
      userId: user.id,
    },
    include: {
      company: true,
    },
  });

  return {
    user,
    membership,
  };
});
