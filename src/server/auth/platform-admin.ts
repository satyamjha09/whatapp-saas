import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { recordSecurityEvent } from "@/server/services/security-event.service";
import { getRequestIp } from "@/server/utils/request-ip";

export class PlatformAuthorizationError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "PlatformAuthorizationError";
    this.status = status;
  }
}

function parseCsv(value: string | undefined | null) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformAdminEnabled() {
  return process.env.PLATFORM_ADMIN_ENABLED !== "false";
}

export function getPlatformAdminEmails() {
  return parseCsv(process.env.PLATFORM_ADMIN_EMAILS);
}

function getPrimaryEmail(clerkUser: Awaited<ReturnType<typeof currentUser>>) {
  if (!clerkUser) return null;

  const primary = clerkUser.emailAddresses.find(
    (email) => email.id === clerkUser.primaryEmailAddressId,
  );

  return primary?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress ?? null;
}

export async function getPlatformAdminContext() {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    throw new PlatformAuthorizationError("Unauthorized", 401);
  }

  const email = getPrimaryEmail(clerkUser);

  if (!email) {
    throw new PlatformAuthorizationError("No email address found", 403);
  }

  const user = await prisma.user.findUnique({
    where: {
      clerkUserId: clerkUser.id,
    },
  });

  return {
    clerkUser,
    user,
    email: email.toLowerCase(),
  };
}

export async function requirePlatformAdmin({
  request,
}: {
  request?: Request;
} = {}) {
  const context = await getPlatformAdminContext();

  if (!isPlatformAdminEnabled()) {
    throw new PlatformAuthorizationError("Platform admin console is disabled", 403);
  }

  const allowedEmails = getPlatformAdminEmails();

  if (!allowedEmails.includes(context.email)) {
    if (request) {
      await recordSecurityEvent({
        type: "AUTH_FAILURE",
        severity: "HIGH",
        source: "platform-admin",
        summary: "Non-platform-admin attempted to access platform console",
        method: request.method,
        path: new URL(request.url).pathname,
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
        metadata: {
          email: context.email,
          allowedEmailCount: allowedEmails.length,
        },
      }).catch(() => undefined);
    }

    throw new PlatformAuthorizationError("Platform admin access required", 403);
  }

  return context;
}

export function getPlatformAdminSummary() {
  return {
    enabled: isPlatformAdminEnabled(),
    configuredAdminCount: getPlatformAdminEmails().length,
  };
}
