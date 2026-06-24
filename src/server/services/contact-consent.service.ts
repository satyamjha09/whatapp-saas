import {
  ContactConsentSource,
  ContactConsentStatus,
  ContactConsentType,
  Prisma,
  TemplateCategory,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { recordContactActivity } from "@/server/services/contact-activity.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";

export class ConsentRequiredError extends Error {
  constructor(message = "Marketing consent is required for this contact") {
    super(message);
    this.name = "ConsentRequiredError";
  }
}

function isEnabled() {
  return process.env.CONSENT_LEDGER_ENABLED !== "false";
}

function requireMarketingOptIn() {
  return process.env.CONSENT_REQUIRE_MARKETING_OPT_IN !== "false";
}

function allowUtilityWithoutMarketingOptIn() {
  return process.env.CONSENT_ALLOW_UTILITY_WITHOUT_MARKETING_OPT_IN !== "false";
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

export async function recordContactConsent({
  companyId,
  contactId,
  type,
  status,
  source,
  actorUserId,
  evidenceText,
  evidenceUrl,
  ipAddress,
  userAgent,
  metadata,
}: {
  companyId: string;
  contactId: string;
  type: ContactConsentType;
  status: ContactConsentStatus;
  source: ContactConsentSource;
  actorUserId?: string | null;
  evidenceText?: string | null;
  evidenceUrl?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: unknown;
}) {
  if (!isEnabled()) {
    return null;
  }

  const event = await prisma.contactConsentEvent.create({
    data: {
      companyId,
      contactId,
      type,
      status,
      source,
      actorUserId: actorUserId ?? null,
      evidenceText: evidenceText ?? null,
      evidenceUrl: evidenceUrl ?? null,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      metadata: metadata !== undefined ? safeJson(metadata) : undefined,
    },
  });

  const consentAt = new Date();
  const contactUpdate: Prisma.ContactUpdateInput = {};

  if (type === "WHATSAPP_MARKETING") {
    contactUpdate.marketingConsentStatus = status;
    contactUpdate.marketingConsentAt = consentAt;
    contactUpdate.marketingConsentSource = source;
  }

  if (type === "WHATSAPP_UTILITY" || type === "WHATSAPP_SERVICE") {
    contactUpdate.utilityConsentStatus = status;
    contactUpdate.utilityConsentAt = consentAt;
    contactUpdate.utilityConsentSource = source;
  }

  if (Object.keys(contactUpdate).length > 0) {
    await prisma.contact.update({
      where: { id: contactId },
      data: contactUpdate,
    });
  }

  await recordContactActivity({
    companyId,
    contactId,
    actorUserId,
    type: status === "GRANTED" ? "OPTED_IN" : "OPTED_OUT",
    title:
      status === "GRANTED"
        ? `${type.replaceAll("_", " ")} consent granted`
        : `${type.replaceAll("_", " ")} consent revoked`,
    metadata: {
      consentEventId: event.id,
      type,
      status,
      source,
    },
  }).catch(() => undefined);

  return event;
}

export async function grantMarketingConsent({
  companyId,
  contactId,
  source,
  actorUserId,
  evidenceText,
  metadata,
}: {
  companyId: string;
  contactId: string;
  source: ContactConsentSource;
  actorUserId?: string | null;
  evidenceText?: string | null;
  metadata?: unknown;
}) {
  return recordContactConsent({
    companyId,
    contactId,
    type: "WHATSAPP_MARKETING",
    status: "GRANTED",
    source,
    actorUserId,
    evidenceText,
    metadata,
  });
}

export async function revokeMarketingConsent({
  companyId,
  contactId,
  source,
  actorUserId,
  evidenceText,
  metadata,
}: {
  companyId: string;
  contactId: string;
  source: ContactConsentSource;
  actorUserId?: string | null;
  evidenceText?: string | null;
  metadata?: unknown;
}) {
  return recordContactConsent({
    companyId,
    contactId,
    type: "WHATSAPP_MARKETING",
    status: "REVOKED",
    source,
    actorUserId,
    evidenceText,
    metadata,
  });
}

export async function assertContactCanReceiveTemplate({
  companyId,
  contactId,
  templateCategory,
}: {
  companyId: string;
  contactId: string;
  templateCategory: TemplateCategory;
}) {
  if (!isEnabled()) return;

  const contact = await prisma.contact.findFirst({
    where: {
      id: contactId,
      companyId,
    },
    select: {
      id: true,
      isBlocked: true,
      optedOutAt: true,
      marketingConsentStatus: true,
      utilityConsentStatus: true,
    },
  });

  if (!contact) {
    throw new Error("Contact not found");
  }

  if (contact.isBlocked || contact.optedOutAt) {
    throw new ConsentRequiredError("Contact has opted out or is blocked");
  }

  if (templateCategory === "MARKETING" && requireMarketingOptIn()) {
    if (contact.marketingConsentStatus !== "GRANTED") {
      throw new ConsentRequiredError(
        "Marketing opt-in is required before sending marketing templates",
      );
    }
  }

  if (
    templateCategory === "UTILITY" &&
    !allowUtilityWithoutMarketingOptIn() &&
    contact.utilityConsentStatus !== "GRANTED"
  ) {
    throw new ConsentRequiredError(
      "Utility consent is required before sending utility templates",
    );
  }
}

export async function getContactConsentTimeline({
  companyId,
  contactId,
}: {
  companyId: string;
  contactId: string;
}) {
  return prisma.contactConsentEvent.findMany({
    where: {
      companyId,
      contactId,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

export async function getConsentLedgerHealth() {
  const [grantedMarketing, revokedMarketing, unknownMarketing, events24h] =
    await Promise.all([
      prisma.contact.count({
        where: {
          marketingConsentStatus: "GRANTED",
        },
      }),
      prisma.contact.count({
        where: {
          marketingConsentStatus: "REVOKED",
        },
      }),
      prisma.contact.count({
        where: {
          marketingConsentStatus: "UNKNOWN",
        },
      }),
      prisma.contactConsentEvent.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

  return {
    enabled: isEnabled(),
    requireMarketingOptIn: requireMarketingOptIn(),
    retentionDays: Number(process.env.CONSENT_RETENTION_DAYS ?? 1825),
    grantedMarketing,
    revokedMarketing,
    unknownMarketing,
    events24h,
    isHealthy: isEnabled(),
  };
}
