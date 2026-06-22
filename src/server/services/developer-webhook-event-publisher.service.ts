import type { MessageStatus } from "@/generated/prisma/enums";
import type { DeveloperWebhookEvent } from "@/server/config/developer-webhook-events";
import { publishDeveloperWebhookEvent } from "@/server/services/developer-webhook-outbox.service";

function messageStatusToDeveloperEvent(
  status: MessageStatus,
): DeveloperWebhookEvent | null {
  if (status === "SENT") return "message.sent";
  if (status === "DELIVERED") return "message.delivered";
  if (status === "READ") return "message.read";
  if (status === "FAILED") return "message.failed";
  if (status === "RECEIVED") return "message.received";
  return null;
}

export async function publishMessageDeveloperWebhookEvent({
  companyId,
  message,
}: {
  companyId: string;
  message: {
    id: string;
    contactId?: string | null;
    toPhoneNumber?: string | null;
    status: MessageStatus;
    direction?: string | null;
    templateId?: string | null;
    body?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
  };
}) {
  const eventType = messageStatusToDeveloperEvent(message.status);
  if (!eventType) return null;

  return publishDeveloperWebhookEvent({
    companyId,
    eventType,
    idempotencyKey: `${eventType}:${message.id}:${message.status}`,
    payload: {
      messageId: message.id,
      contactId: message.contactId ?? null,
      phoneNumber: message.toPhoneNumber ?? null,
      status: message.status,
      direction: message.direction ?? null,
      templateId: message.templateId ?? null,
      text: message.body ?? null,
      createdAt: message.createdAt?.toISOString() ?? null,
      updatedAt: message.updatedAt?.toISOString() ?? null,
    },
  });
}

export async function publishContactDeveloperWebhookEvent({
  companyId,
  contact,
  operation,
}: {
  companyId: string;
  contact: {
    id: string;
    name?: string | null;
    phoneNumber: string;
    countryCode?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
  };
  operation: "created" | "updated";
}) {
  const eventType =
    operation === "created" ? "contact.created" : "contact.updated";
  const timestamp =
    operation === "created" ? contact.createdAt : contact.updatedAt;

  return publishDeveloperWebhookEvent({
    companyId,
    eventType,
    idempotencyKey:
      operation === "created"
        ? `contact.created:${contact.id}`
        : `contact.updated:${contact.id}:${timestamp?.getTime() ?? 0}`,
    payload: {
      contactId: contact.id,
      name: contact.name ?? null,
      phoneNumber: contact.phoneNumber,
      countryCode: contact.countryCode ?? null,
      createdAt: contact.createdAt?.toISOString() ?? null,
      updatedAt: contact.updatedAt?.toISOString() ?? null,
    },
  });
}

export async function publishWalletDeveloperWebhookEvent({
  companyId,
  transaction,
  balanceAfterPaise,
}: {
  companyId: string;
  transaction: {
    id: string;
    type: string;
    status: string;
    amountPaise: number;
    description?: string | null;
    referenceId?: string | null;
    createdAt?: Date;
  };
  balanceAfterPaise: number;
}) {
  const eventType =
    transaction.type === "CREDIT"
      ? "wallet.credit_added"
      : transaction.type === "DEBIT"
        ? "wallet.credit_deducted"
        : null;

  if (!eventType || transaction.status !== "SUCCESS") return null;

  return publishDeveloperWebhookEvent({
    companyId,
    eventType,
    idempotencyKey: `${eventType}:${transaction.id}`,
    payload: {
      transactionId: transaction.id,
      type: transaction.type,
      status: transaction.status,
      amountPaise: transaction.amountPaise,
      balanceAfterPaise,
      description: transaction.description ?? null,
      referenceId: transaction.referenceId ?? null,
      createdAt: transaction.createdAt?.toISOString() ?? null,
    },
  });
}

export async function publishCampaignDeveloperWebhookEvent({
  companyId,
  campaign,
  operation,
}: {
  companyId: string;
  campaign: {
    id: string;
    name?: string | null;
    status: string;
    totalContacts: number;
    sentCount?: number;
    failedCount?: number;
    createdAt?: Date;
    updatedAt?: Date;
  };
  operation: "created" | "completed";
}) {
  const eventType =
    operation === "created" ? "campaign.created" : "campaign.completed";

  return publishDeveloperWebhookEvent({
    companyId,
    eventType,
    idempotencyKey: `${eventType}:${campaign.id}`,
    payload: {
      campaignId: campaign.id,
      name: campaign.name ?? null,
      status: campaign.status,
      totalCount: campaign.totalContacts,
      sentCount: campaign.sentCount ?? 0,
      failedCount: campaign.failedCount ?? 0,
      createdAt: campaign.createdAt?.toISOString() ?? null,
      completedAt:
        operation === "completed"
          ? campaign.updatedAt?.toISOString() ?? null
          : null,
    },
  });
}
