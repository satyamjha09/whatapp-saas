import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {
  Prisma,
  PrivacyRequestSource,
  PrivacyRequestType,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createIncident } from "@/server/services/incident.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";

function isEnabled() {
  return process.env.PRIVACY_CENTER_ENABLED !== "false";
}

export function getPrivacyExportDir() {
  const configuredDir =
    process.env.PRIVACY_EXPORT_DIR || "./private/privacy-exports";

  return path.isAbsolute(configuredDir)
    ? configuredDir
    : path.join(/* turbopackIgnore: true */ process.cwd(), configuredDir);
}

function exportTtlHours() {
  const parsed = Number(process.env.PRIVACY_EXPORT_TTL_HOURS ?? 72);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 72;
}

function retentionDays() {
  const parsed = Number(process.env.PRIVACY_REQUEST_RETENTION_DAYS ?? 365);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 365;
}

function requiresDeleteConfirmation() {
  return process.env.PRIVACY_DELETE_REQUIRE_CONFIRMATION !== "false";
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

function createExportToken() {
  return crypto.randomBytes(12).toString("hex");
}

async function ensureExportDirectory() {
  await fs.mkdir(getPrivacyExportDir(), { recursive: true });
}

async function writeExportFile({
  fileName,
  data,
}: {
  fileName: string;
  data: unknown;
}) {
  await ensureExportDirectory();
  const filePath = path.join(getPrivacyExportDir(), fileName);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
  return filePath;
}

export async function createPrivacyRequest({
  companyId,
  contactId,
  requestedByUserId,
  type,
  source = "DASHBOARD",
  requesterEmail,
  reason,
  confirmationText,
  metadata,
}: {
  companyId: string;
  contactId?: string | null;
  requestedByUserId?: string | null;
  type: PrivacyRequestType;
  source?: PrivacyRequestSource;
  requesterEmail?: string | null;
  reason?: string | null;
  confirmationText?: string | null;
  metadata?: unknown;
}) {
  if (!isEnabled()) {
    throw new Error("Privacy Center is disabled");
  }

  if ((type === "CONTACT_EXPORT" || type === "CONTACT_DELETE") && !contactId) {
    throw new Error("contactId is required for contact privacy requests");
  }

  if (
    type === "CONTACT_DELETE" &&
    requiresDeleteConfirmation() &&
    confirmationText !== "DELETE CONTACT DATA"
  ) {
    throw new Error('Confirmation text must be "DELETE CONTACT DATA"');
  }

  return prisma.privacyRequest.create({
    data: {
      companyId,
      contactId: contactId ?? null,
      requestedByUserId: requestedByUserId ?? null,
      type,
      source,
      requesterEmail: requesterEmail ?? null,
      reason: reason ?? null,
      confirmationText: confirmationText ?? null,
      metadata: metadata ? safeJson(metadata) : undefined,
    },
  });
}

export async function getContactPrivacyExportData({
  companyId,
  contactId,
}: {
  companyId: string;
  contactId: string;
}) {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, companyId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          events: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
      inboxNotes: {
        orderBy: { createdAt: "asc" },
      },
      inboxTags: {
        include: { tag: true },
      },
      campaignContacts: true,
      contactGroupMembers: {
        include: { group: true },
      },
    },
  });

  if (!contact) {
    throw new Error("Contact not found");
  }

  return {
    exportedAt: new Date().toISOString(),
    type: "CONTACT_EXPORT",
    companyId,
    contactId,
    contact: redactSensitiveData(contact),
  };
}

export async function processContactExportRequest({
  requestId,
}: {
  requestId: string;
}) {
  const request = await prisma.privacyRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw new Error("Privacy request not found");
  }

  if (request.type !== "CONTACT_EXPORT" || !request.contactId) {
    throw new Error("Privacy request is not a contact export request");
  }

  await prisma.privacyRequest.update({
    where: { id: requestId },
    data: { status: "PROCESSING" },
  });

  try {
    const data = await getContactPrivacyExportData({
      companyId: request.companyId,
      contactId: request.contactId,
    });
    const fileName = `contact-export-${request.companyId}-${request.contactId}-${createExportToken()}.json`;
    const filePath = await writeExportFile({ fileName, data });
    const expiresAt = new Date(Date.now() + exportTtlHours() * 60 * 60 * 1000);

    return prisma.privacyRequest.update({
      where: { id: requestId },
      data: {
        status: "COMPLETED",
        exportFilePath: filePath,
        exportFileName: fileName,
        exportExpiresAt: expiresAt,
        processedAt: new Date(),
        failedAt: null,
        failureReason: null,
      },
    });
  } catch (error) {
    const failureReason =
      error instanceof Error ? error.message : "Unknown contact export error";

    await prisma.privacyRequest.update({
      where: { id: requestId },
      data: { status: "FAILED", failedAt: new Date(), failureReason },
    });

    await createIncident({
      companyId: request.companyId,
      title: "Privacy contact export failed",
      description: failureReason,
      source: "SYSTEM",
      severity: "HIGH",
      idempotencyKey: `privacy-export-failed:${requestId}`,
      metadata: { requestId, contactId: request.contactId },
    }).catch(() => undefined);

    throw error;
  }
}

export async function processContactDeleteRequest({
  requestId,
}: {
  requestId: string;
}) {
  const request = await prisma.privacyRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw new Error("Privacy request not found");
  }

  if (request.type !== "CONTACT_DELETE" || !request.contactId) {
    throw new Error("Privacy request is not a contact delete request");
  }

  await prisma.privacyRequest.update({
    where: { id: requestId },
    data: { status: "PROCESSING" },
  });

  try {
    const contact = await prisma.contact.findFirst({
      where: { id: request.contactId, companyId: request.companyId },
    });

    if (!contact) {
      return prisma.privacyRequest.update({
        where: { id: requestId },
        data: {
          status: "COMPLETED",
          processedAt: new Date(),
          metadata: safeJson({ result: "Contact already deleted" }),
        },
      });
    }

    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        name: null,
        email: null,
        companyName: null,
        externalCustomerId: null,
        phoneNumber: `deleted-${contact.id}`,
        countryCode: "00",
        source: "PRIVACY_DELETE",
        isBlocked: true,
        blockedAt: new Date(),
        optedOutAt: new Date(),
        optOutReason: "Privacy deletion request",
        optOutSource: "PRIVACY_CENTER",
      },
    });

    return prisma.privacyRequest.update({
      where: { id: requestId },
      data: {
        status: "COMPLETED",
        processedAt: new Date(),
        failedAt: null,
        failureReason: null,
        metadata: safeJson({ anonymizedContactId: contact.id }),
      },
    });
  } catch (error) {
    const failureReason =
      error instanceof Error ? error.message : "Unknown contact deletion error";

    await prisma.privacyRequest.update({
      where: { id: requestId },
      data: { status: "FAILED", failedAt: new Date(), failureReason },
    });

    await createIncident({
      companyId: request.companyId,
      title: "Privacy contact deletion failed",
      description: failureReason,
      source: "SYSTEM",
      severity: "CRITICAL",
      idempotencyKey: `privacy-delete-failed:${requestId}`,
      metadata: { requestId, contactId: request.contactId },
    }).catch(() => undefined);

    throw error;
  }
}

export async function processPrivacyRequest({
  requestId,
}: {
  requestId: string;
}) {
  const request = await prisma.privacyRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw new Error("Privacy request not found");
  }

  if (request.type === "CONTACT_EXPORT") {
    return processContactExportRequest({ requestId });
  }

  if (request.type === "CONTACT_DELETE") {
    return processContactDeleteRequest({ requestId });
  }

  throw new Error(`Unsupported privacy request type: ${request.type}`);
}

export async function listPrivacyRequests({
  companyId,
  take = 100,
}: {
  companyId: string;
  take?: number;
}) {
  return prisma.privacyRequest.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      contact: true,
      requestedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

export async function getPrivacyRequest({
  companyId,
  requestId,
}: {
  companyId: string;
  requestId: string;
}) {
  return prisma.privacyRequest.findFirst({
    where: { id: requestId, companyId },
    include: {
      contact: true,
      requestedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

export async function cleanupExpiredPrivacyExports() {
  const expired = await prisma.privacyRequest.findMany({
    where: {
      exportFilePath: { not: null },
      exportExpiresAt: { lt: new Date() },
    },
  });

  let deleted = 0;

  for (const request of expired) {
    if (!request.exportFilePath) continue;

    await fs.unlink(request.exportFilePath).catch(() => undefined);
    await prisma.privacyRequest.update({
      where: { id: request.id },
      data: {
        exportFilePath: null,
        exportFileName: null,
        exportExpiresAt: null,
      },
    });
    deleted += 1;
  }

  return { deleted };
}

export async function cleanupOldPrivacyRequests() {
  return prisma.privacyRequest.deleteMany({
    where: {
      createdAt: {
        lt: new Date(Date.now() - retentionDays() * 24 * 60 * 60 * 1000),
      },
      status: { in: ["COMPLETED", "FAILED", "CANCELLED"] },
      exportFilePath: null,
    },
  });
}

export async function getPrivacyCenterHealth() {
  const [pending, failed24h, completed24h, expiredFiles] = await Promise.all([
    prisma.privacyRequest.count({
      where: { status: { in: ["PENDING", "PROCESSING"] } },
    }),
    prisma.privacyRequest.count({
      where: {
        status: "FAILED",
        failedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.privacyRequest.count({
      where: {
        status: "COMPLETED",
        processedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.privacyRequest.count({
      where: {
        exportFilePath: { not: null },
        exportExpiresAt: { lt: new Date() },
      },
    }),
  ]);

  return {
    enabled: isEnabled(),
    isHealthy: isEnabled() && failed24h === 0,
    pending,
    failed24h,
    completed24h,
    expiredFiles,
  };
}
