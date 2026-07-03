import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { syncUser } from "@/server/services/auth.service";

export const dynamic = "force-dynamic";

type SsoCallbackPageProps = {
  searchParams: Promise<{
    redirect_url?: string;
    redirectUrl?: string;
    returnTo?: string;
  }>;
};

function safeInternalRedirect(value?: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  if (
    value.startsWith("/sign-in") ||
    value.startsWith("/sign-up") ||
    value.startsWith("/auth/sso-callback")
  ) {
    return null;
  }

  return value;
}

function getPrimaryEmail(clerkUser: Awaited<ReturnType<typeof currentUser>>) {
  if (!clerkUser) return null;

  return (
    clerkUser.emailAddresses.find(
      (email) => email.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    null
  );
}

function getDisplayName(clerkUser: NonNullable<Awaited<ReturnType<typeof currentUser>>>) {
  return (
    clerkUser.fullName ??
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ??
    null
  );
}

export default async function SsoCallbackPage({
  searchParams,
}: SsoCallbackPageProps) {
  const params = await searchParams;
  const requestedRedirect = safeInternalRedirect(
    params.redirect_url ?? params.redirectUrl ?? params.returnTo,
  );

  const clerkUser = await currentUser();

  if (!clerkUser) {
    const signInTarget = requestedRedirect
      ? `/sign-in?redirect_url=${encodeURIComponent(requestedRedirect)}`
      : "/sign-in";
    redirect(signInTarget);
  }

  const primaryEmail = getPrimaryEmail(clerkUser);

  if (!primaryEmail) {
    redirect("/sign-in?error=no_email");
  }

  const user = await syncUser({
    clerkUserId: clerkUser.id,
    email: primaryEmail,
    name: getDisplayName(clerkUser),
    imageUrl: clerkUser.imageUrl,
  });

  const membership = await prisma.companyUser.findFirst({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!membership) {
    if (requestedRedirect?.startsWith("/invite/")) {
      redirect(requestedRedirect);
    }

    redirect("/onboarding/company");
  }

  await prisma.userWorkspacePreference.upsert({
    where: {
      userId: user.id,
    },
    create: {
      userId: user.id,
      activeCompanyId: membership.companyId,
      lastSelectedAt: new Date(),
    },
    update: {
      activeCompanyId: membership.companyId,
      lastSelectedAt: new Date(),
    },
  });

  redirect(requestedRedirect ?? "/dashboard");
}
