import { prisma } from "@/lib/prisma";
import { recordSecurityEvent } from "@/server/services/security-event.service";
import { getRequestIp } from "@/server/utils/request-ip";
import { logger } from "@/server/utils/safe-logger";

export type TenantEntityType =
  | "Contact"
  | "Message"
  | "Template"
  | "ContactGroup"
  | "ContactGroupMember"
  | "InboxNote"
  | "InboxQuickReply"
  | "InboxTag"
  | "Campaign"
  | "BulkMessageBatch"
  | "BulkMessageRecipient"
  | "DeveloperApiKey"
  | "DeveloperWebhook"
  | "DeveloperWebhookOutboxEvent"
  | "Payment"
  | "WalletTransaction"
  | "CompanyNotification";

const PROTECTED_ENTITIES = [
  "Contact",
  "Message",
  "Template",
  "ContactGroup",
  "ContactGroupMember",
  "InboxNote",
  "InboxQuickReply",
  "InboxTag",
  "Campaign",
  "BulkMessageBatch",
  "BulkMessageRecipient",
  "DeveloperApiKey",
  "DeveloperWebhook",
  "DeveloperWebhookOutboxEvent",
  "Payment",
  "WalletTransaction",
  "CompanyNotification",
] satisfies TenantEntityType[];

export class TenantAccessError extends Error {
  status = 404;

  constructor(message = "Resource not found") {
    super(message);
    this.name = "TenantAccessError";
  }
}

function isTenantGuardEnabled() {
  return process.env.TENANT_GUARD_ENABLED !== "false";
}

async function recordTenantViolation({
  request,
  companyId,
  entityType,
  entityId,
}: {
  request?: Request;
  companyId: string;
  entityType: TenantEntityType;
  entityId: string;
}) {
  if (!request) return;

  await recordSecurityEvent({
    type: "SUSPICIOUS_REQUEST",
    severity: "HIGH",
    source: "tenant-guard",
    summary: `Tenant access denied for ${entityType}`,
    method: request.method,
    path: new URL(request.url).pathname,
    ipAddress: getRequestIp(request),
    userAgent: request.headers.get("user-agent"),
    metadata: {
      companyId,
      entityType,
      entityId,
    },
  }).catch((error) => {
    logger.error("Tenant guard security event recording failed", {
      error,
      entityType,
    });
  });
}

export function assertSameCompany({
  actualCompanyId,
  expectedCompanyId,
}: {
  actualCompanyId?: string | null;
  expectedCompanyId: string;
}) {
  if (!isTenantGuardEnabled()) return;

  if (!actualCompanyId || actualCompanyId !== expectedCompanyId) {
    throw new TenantAccessError();
  }
}

export async function assertTenantEntityAccess({
  request,
  companyId,
  entityType,
  entityId,
}: {
  request?: Request;
  companyId: string;
  entityType: TenantEntityType;
  entityId: string;
}) {
  if (!isTenantGuardEnabled()) {
    return;
  }

  const exists = await tenantEntityExists({
    companyId,
    entityType,
    entityId,
  });

  if (!exists) {
    await recordTenantViolation({
      request,
      companyId,
      entityType,
      entityId,
    });

    throw new TenantAccessError();
  }
}

async function tenantEntityExists({
  companyId,
  entityType,
  entityId,
}: {
  companyId: string;
  entityType: TenantEntityType;
  entityId: string;
}) {
  switch (entityType) {
    case "Contact":
      return Boolean(
        await prisma.contact.findFirst({
          where: { id: entityId, companyId },
          select: { id: true },
        }),
      );

    case "Message":
      return Boolean(
        await prisma.message.findFirst({
          where: { id: entityId, companyId },
          select: { id: true },
        }),
      );

    case "Template":
      return Boolean(
        await prisma.template.findFirst({
          where: { id: entityId, companyId },
          select: { id: true },
        }),
      );

    case "ContactGroup":
      return Boolean(
        await prisma.contactGroup.findFirst({
          where: { id: entityId, companyId },
          select: { id: true },
        }),
      );

    case "ContactGroupMember":
      return Boolean(
        await prisma.contactGroupMember.findFirst({
          where: {
            id: entityId,
            group: { companyId },
          },
          select: { id: true },
        }),
      );

    case "InboxNote":
      return Boolean(
        await prisma.inboxNote.findFirst({
          where: { id: entityId, companyId },
          select: { id: true },
        }),
      );

    case "InboxQuickReply":
      return Boolean(
        await prisma.quickReply.findFirst({
          where: { id: entityId, companyId },
          select: { id: true },
        }),
      );

    case "InboxTag":
      return Boolean(
        await prisma.inboxTag.findFirst({
          where: { id: entityId, companyId },
          select: { id: true },
        }),
      );

    case "Campaign":
      return Boolean(
        await prisma.campaign.findFirst({
          where: { id: entityId, companyId },
          select: { id: true },
        }),
      );

    case "BulkMessageBatch":
      return Boolean(
        await prisma.bulkMessageBatch.findFirst({
          where: { id: entityId, companyId },
          select: { id: true },
        }),
      );

    case "BulkMessageRecipient":
      return Boolean(
        await prisma.bulkMessageBatchRecipient.findFirst({
          where: {
            id: entityId,
            batch: { companyId },
          },
          select: { id: true },
        }),
      );

    case "DeveloperApiKey":
      return Boolean(
        await prisma.apiKey.findFirst({
          where: { id: entityId, companyId },
          select: { id: true },
        }),
      );

    case "DeveloperWebhook":
      return Boolean(
        await prisma.developerWebhookEndpoint.findFirst({
          where: { id: entityId, companyId },
          select: { id: true },
        }),
      );

    case "DeveloperWebhookOutboxEvent":
      return Boolean(
        await prisma.developerWebhookOutbox.findFirst({
          where: { id: entityId, companyId },
          select: { id: true },
        }),
      );

    case "Payment":
      return Boolean(
        (await prisma.creditPurchase.findFirst({
          where: { id: entityId, companyId },
          select: { id: true },
        })) ||
          (await prisma.subscriptionPayment.findFirst({
            where: { id: entityId, companyId },
            select: { id: true },
          })),
      );

    case "WalletTransaction":
      return Boolean(
        await prisma.walletTransaction.findFirst({
          where: { id: entityId, companyId },
          select: { id: true },
        }),
      );

    case "CompanyNotification":
      return Boolean(
        await prisma.companyNotification.findFirst({
          where: { id: entityId, companyId },
          select: { id: true },
        }),
      );

    default:
      return false;
  }
}

export function getTenantGuardSummary() {
  return {
    enabled: isTenantGuardEnabled(),
    protectedEntities: PROTECTED_ENTITIES,
  };
}
