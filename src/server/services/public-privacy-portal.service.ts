import nodemailer from "nodemailer";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createPublicPrivacyToken,
  hashPrivacyEmail,
  hashPublicPrivacyToken,
  normalizePrivacyEmail,
} from "@/server/services/public-privacy-token.service";
import { createPrivacyRequest } from "@/server/services/privacy-center.service";
import { recordSecurityEvent } from "@/server/services/security-event.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";

type PublicPrivacyIntent = "CONTACT_EXPORT" | "CONTACT_DELETE";

function isEnabled() {
  return process.env.PUBLIC_PRIVACY_PORTAL_ENABLED !== "false";
}

function tokenTtlMinutes() {
  const parsed = Number(process.env.PUBLIC_PRIVACY_TOKEN_TTL_MINUTES ?? 30);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

function maxRequestsPerEmailPerDay() {
  const parsed = Number(
    process.env.PUBLIC_PRIVACY_MAX_REQUESTS_PER_EMAIL_PER_DAY ?? 3,
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
}

function portalUrl() {
  return (process.env.PUBLIC_PRIVACY_PORTAL_URL || "http://localhost:3000/privacy").replace(
    /\/+$/,
    "",
  );
}

function getFrom() {
  return (
    process.env.PUBLIC_PRIVACY_EMAIL_FROM ||
    process.env.SMTP_FROM ||
    "TallyKonnect Privacy <privacy@localhost>"
  );
}

function getReplyTo() {
  return process.env.PUBLIC_PRIVACY_EMAIL_REPLY_TO || process.env.SMTP_FROM || undefined;
}

function getTransporter() {
  if (!process.env.SMTP_HOST) {
    throw new Error("SMTP_HOST is required for public privacy portal emails");
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASSWORD
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          }
        : undefined,
  });
}

async function sendPrivacyVerificationEmail({
  to,
  token,
  intent,
}: {
  to: string;
  token: string;
  intent: PublicPrivacyIntent;
}) {
  const confirmUrl = `${portalUrl()}/confirm?token=${encodeURIComponent(token)}`;
  const subject =
    intent === "CONTACT_DELETE"
      ? "Confirm your data deletion request"
      : "Confirm your data export request";
  const actionText =
    intent === "CONTACT_DELETE"
      ? "confirm your deletion request"
      : "confirm your export request";

  await getTransporter().sendMail({
    from: getFrom(),
    replyTo: getReplyTo(),
    to,
    subject,
    text: `Please ${actionText}: ${confirmUrl}\n\nThis link expires in ${tokenTtlMinutes()} minutes.`,
    html: `
      <p>Please ${actionText}.</p>
      <p><a href="${confirmUrl}">Confirm request</a></p>
      <p style="font-size:12px;color:#666;">This link expires in ${tokenTtlMinutes()} minutes.</p>
    `,
  });
}

function normalizeCountryCode(countryCode?: string | null) {
  return countryCode?.replace(/^\+/, "").trim() || null;
}

async function findContactForPublicPrivacyRequest({
  phoneNumber,
  countryCode,
}: {
  phoneNumber?: string | null;
  countryCode?: string | null;
}) {
  if (!phoneNumber) return null;

  return prisma.contact.findFirst({
    where: {
      phoneNumber: phoneNumber.trim(),
      ...(countryCode ? { countryCode: normalizeCountryCode(countryCode) ?? undefined } : {}),
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function createPublicPrivacyVerification({
  email,
  phoneNumber,
  countryCode,
  intent,
  reason,
  requesterIp,
  userAgent,
}: {
  email: string;
  phoneNumber?: string | null;
  countryCode?: string | null;
  intent: PublicPrivacyIntent;
  reason?: string | null;
  requesterIp?: string | null;
  userAgent?: string | null;
}) {
  if (!isEnabled()) {
    throw new Error("Public Privacy Portal is disabled");
  }

  const normalizedEmail = normalizePrivacyEmail(email);
  const emailHash = hashPrivacyEmail(normalizedEmail);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCount = await prisma.publicPrivacyVerification.count({
    where: {
      emailHash,
      createdAt: {
        gte: since,
      },
    },
  });

  if (recentCount >= maxRequestsPerEmailPerDay()) {
    await recordSecurityEvent({
      type: "SUSPICIOUS_REQUEST",
      severity: "MEDIUM",
      source: "public-privacy-portal",
      summary: "Public privacy request limit exceeded",
      path: "/api/privacy/public/request",
      method: "POST",
      ipAddress: requesterIp ?? null,
      userAgent: userAgent ?? null,
      metadata: {
        emailHash,
        recentCount,
      },
    }).catch(() => undefined);

    throw new Error("Too many privacy requests. Please try again later.");
  }

  const contact = await findContactForPublicPrivacyRequest({
    phoneNumber,
    countryCode,
  });
  const token = createPublicPrivacyToken();

  const verification = await prisma.publicPrivacyVerification.create({
    data: {
      companyId: contact?.companyId ?? null,
      email: normalizedEmail,
      emailHash,
      phoneNumber: phoneNumber?.trim() ?? null,
      countryCode: normalizeCountryCode(countryCode),
      intent,
      tokenHash: hashPublicPrivacyToken(token),
      requesterIp: requesterIp ?? null,
      userAgent: userAgent ?? null,
      reason: reason ?? null,
      expiresAt: new Date(Date.now() + tokenTtlMinutes() * 60 * 1000),
      metadata: redactSensitiveData({
        matchedContactId: contact?.id ?? null,
      }) as Prisma.InputJsonValue,
    },
  });

  try {
    await sendPrivacyVerificationEmail({
      to: normalizedEmail,
      token,
      intent,
    });
  } catch (error) {
    const failureReason =
      error instanceof Error ? error.message : "Unable to send verification email";

    await prisma.publicPrivacyVerification.update({
      where: { id: verification.id },
      data: {
        status: "FAILED",
        failureReason,
      },
    });

    throw error;
  }

  return {
    verificationId: verification.id,
    matched: Boolean(contact),
  };
}

export async function confirmPublicPrivacyVerification({
  token,
}: {
  token: string;
}) {
  if (!isEnabled()) {
    throw new Error("Public Privacy Portal is disabled");
  }

  const tokenHash = hashPublicPrivacyToken(token);
  const verification = await prisma.publicPrivacyVerification.findFirst({
    where: {
      tokenHash,
      status: "PENDING",
    },
  });

  if (!verification) {
    throw new Error("Invalid privacy confirmation link");
  }

  if (verification.expiresAt < new Date()) {
    await prisma.publicPrivacyVerification.update({
      where: { id: verification.id },
      data: {
        status: "EXPIRED",
        failureReason: "Verification token expired",
      },
    });

    throw new Error("Privacy confirmation link has expired");
  }

  const contact = await findContactForPublicPrivacyRequest({
    phoneNumber: verification.phoneNumber,
    countryCode: verification.countryCode,
  });

  if (!contact) {
    await prisma.publicPrivacyVerification.update({
      where: { id: verification.id },
      data: {
        status: "FAILED",
        failureReason: "No matching contact found",
        usedAt: new Date(),
      },
    });

    return {
      ok: false,
      message:
        "We could not find a matching contact record. Please contact support.",
    };
  }

  const privacyRequest = await createPrivacyRequest({
    companyId: contact.companyId,
    contactId: contact.id,
    type: verification.intent,
    source: "PUBLIC_API",
    requesterEmail: verification.email,
    reason: verification.reason,
    confirmationText:
      verification.intent === "CONTACT_DELETE" ? "DELETE CONTACT DATA" : null,
    metadata: {
      publicVerificationId: verification.id,
      requesterIp: verification.requesterIp,
      userAgent: verification.userAgent,
    },
  });

  await prisma.publicPrivacyVerification.update({
    where: { id: verification.id },
    data: {
      status: "USED",
      usedAt: new Date(),
      companyId: contact.companyId,
      privacyRequestId: privacyRequest.id,
    },
  });

  return {
    ok: true,
    privacyRequestId: privacyRequest.id,
    message:
      "Your verified privacy request has been received and will be reviewed.",
  };
}

export async function getPublicPrivacyPortalHealth() {
  const [pending, used24h, failed24h, expired24h] = await Promise.all([
    prisma.publicPrivacyVerification.count({
      where: { status: "PENDING" },
    }),
    prisma.publicPrivacyVerification.count({
      where: {
        status: "USED",
        usedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.publicPrivacyVerification.count({
      where: {
        status: "FAILED",
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.publicPrivacyVerification.count({
      where: {
        status: "EXPIRED",
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  return {
    enabled: isEnabled(),
    pending,
    used24h,
    failed24h,
    expired24h,
    isHealthy: isEnabled() && failed24h === 0,
  };
}
