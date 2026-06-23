import "dotenv/config";
import { Worker } from "bullmq";
import { getRedisConnection } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import {
  enqueueDeveloperInboundMessageWebhook,
  enqueueDeveloperMessageStatusWebhook,
} from "@/server/services/developer-webhook.service";
import { updateBulkMessageRecipientTracking } from "@/server/services/bulk-message-tracking.service";
import { calculateInboxSlaDueAt } from "@/server/services/inbox-sla.service";
import type { Prisma } from "@/generated/prisma/client";
import type { MessageStatus } from "@/generated/prisma/enums";
import type { ProcessWebhookJobData } from "@/lib/queue";
import { createWorkerHeartbeat } from "@/server/services/worker-heartbeat.service";

const heartbeat = createWorkerHeartbeat({
  workerName: "webhook-worker",
});

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" ? (value as JsonRecord) : null;
}

function firstArrayItem(value: unknown) {
  return Array.isArray(value) ? value[0] : undefined;
}

function extractStatuses(payload: unknown) {
  const root = asRecord(payload);
  const entry = asRecord(firstArrayItem(root?.entry));
  const change = asRecord(firstArrayItem(entry?.changes));
  const value = asRecord(change?.value);
  const statuses = value?.statuses;

  return Array.isArray(statuses) ? statuses : [];
}

function extractIncomingMessages(payload: unknown) {
  const root = asRecord(payload);
  const entry = asRecord(firstArrayItem(root?.entry));
  const change = asRecord(firstArrayItem(entry?.changes));
  const value = asRecord(change?.value);
  const messages = value?.messages;

  return Array.isArray(messages) ? messages : [];
}

function extractWebhookContacts(payload: unknown) {
  const root = asRecord(payload);
  const entry = asRecord(firstArrayItem(root?.entry));
  const change = asRecord(firstArrayItem(entry?.changes));
  const value = asRecord(change?.value);
  const contacts = value?.contacts;

  return Array.isArray(contacts) ? contacts : [];
}

function getContactNameFromPayload(payload: unknown, waId: string) {
  const contacts = extractWebhookContacts(payload);

  for (const contactValue of contacts) {
    const contact = asRecord(contactValue);

    if (contact?.wa_id !== waId) {
      continue;
    }

    const profile = asRecord(contact.profile);
    const name = profile?.name;

    return typeof name === "string" ? name : null;
  }

  return null;
}

function splitInboundPhoneNumber(phoneNumber: string) {
  if (phoneNumber.startsWith("91") && phoneNumber.length > 10) {
    return {
      countryCode: "91",
      phoneNumber: phoneNumber.slice(2),
    };
  }

  return {
    countryCode: "",
    phoneNumber,
  };
}

function getInboundMessageBody(message: JsonRecord) {
  if (message.type === "text") {
    const text = asRecord(message.text);
    const body = text?.body;

    return typeof body === "string" ? body : "";
  }

  if (message.type === "button") {
    const button = asRecord(message.button);
    const text = button?.text;

    return typeof text === "string" ? text : "";
  }

  if (message.type === "interactive") {
    return JSON.stringify(message.interactive ?? {});
  }

  return `[Unsupported inbound message type: ${String(message.type)}]`;
}

function mapMetaStatusToMessageStatus(status: string): MessageStatus | null {
  switch (status) {
    case "sent":
      return "SENT";
    case "delivered":
      return "DELIVERED";
    case "read":
      return "READ";
    case "failed":
      return "FAILED";
    default:
      return null;
  }
}

const worker = new Worker<ProcessWebhookJobData>(
  "webhook-queue",
  async (job) => {
    const { webhookEventId } = job.data;

    console.log("Processing webhook job:", job.id, webhookEventId);

    const webhookEvent = await prisma.webhookEvent.findUnique({
      where: {
        id: webhookEventId,
      },
    });

    if (!webhookEvent) {
      throw new Error("Webhook event not found");
    }

    await prisma.webhookEvent.update({
      where: {
        id: webhookEvent.id,
      },
      data: {
        status: "PROCESSING",
      },
    });

    const statuses = extractStatuses(webhookEvent.payload);
    const incomingMessages = extractIncomingMessages(webhookEvent.payload);

    for (const incomingMessageValue of incomingMessages) {
      const incomingMessage = asRecord(incomingMessageValue);
      const companyId = webhookEvent.companyId;

      if (!incomingMessage || !companyId) {
        continue;
      }

      const metaMessageId = incomingMessage.id;
      const fromPhoneNumber = incomingMessage.from;

      if (
        typeof metaMessageId !== "string" ||
        typeof fromPhoneNumber !== "string"
      ) {
        continue;
      }

      const existingMessage = await prisma.message.findFirst({
        where: {
          companyId,
          metaMessageId,
        },
      });

      if (existingMessage) {
        continue;
      }

      const phone = splitInboundPhoneNumber(fromPhoneNumber);
      const contactName = getContactNameFromPayload(
        webhookEvent.payload,
        fromPhoneNumber,
      );
      const body = getInboundMessageBody(incomingMessage);

      const contact = await prisma.contact.upsert({
        where: {
          companyId_phoneNumber: {
            companyId,
            phoneNumber: phone.phoneNumber,
          },
        },
        update: {
          name: contactName,
          countryCode: phone.countryCode,
          inboxStatus: "OPEN",
          inboxClosedAt: null,
          snoozedUntil: null,
        },
        create: {
          companyId,
          name: contactName,
          countryCode: phone.countryCode,
          phoneNumber: phone.phoneNumber,
          inboxStatus: "OPEN",
          inboxClosedAt: null,
          snoozedUntil: null,
        },
      });

      const message = await prisma.message.create({
        data: {
          companyId,
          contactId: contact.id,
          direction: "INBOUND",
          status: "RECEIVED",
          toPhoneNumber: fromPhoneNumber,
          body,
          variables: [],
          metaMessageId,
          events: {
            create: {
              companyId,
              status: "RECEIVED",
              raw: incomingMessage as Prisma.InputJsonValue,
            },
          },
        },
      });

      const now = new Date();

      await prisma.contact.update({
        where: {
          id: contact.id,
        },
        data: {
          inboxStatus: "OPEN",
          inboxClosedAt: null,
          snoozedUntil: null,
          inboxLastCustomerMessageAt: now,
          inboxSlaDueAt: calculateInboxSlaDueAt(contact.inboxPriority, now),
          inboxSlaBreachedAt: null,
          inboxSlaEscalationCount: 0,
        },
      });

      await enqueueDeveloperInboundMessageWebhook(companyId, message.id);
    }

    for (const statusEventValue of statuses) {
      const statusEvent = asRecord(statusEventValue);

      if (!statusEvent) {
        continue;
      }

      const metaMessageId = statusEvent?.id;
      const metaStatus = statusEvent?.status;

      if (typeof metaMessageId !== "string" || typeof metaStatus !== "string") {
        continue;
      }

      const nextStatus = mapMetaStatusToMessageStatus(metaStatus);

      if (!nextStatus) {
        continue;
      }

      const timestamp =
        typeof statusEvent.timestamp === "string" ||
        typeof statusEvent.timestamp === "number"
          ? String(statusEvent.timestamp)
          : "no_timestamp";

      const eventDedupeKey = [
        "whatsapp_status",
        metaMessageId,
        metaStatus,
        timestamp,
      ].join(":");

      const existingMessageEvent = await prisma.messageEvent.findUnique({
        where: {
          dedupeKey: eventDedupeKey,
        },
      });

      if (existingMessageEvent) {
        console.log("Duplicate message event skipped:", eventDedupeKey);
        continue;
      }

      const message = await prisma.message.findFirst({
        where: {
          metaMessageId,
        },
      });

      if (!message) {
        continue;
      }

      const updatedMessage = await prisma.message.update({
        where: {
          id: message.id,
        },
        data: {
          status: nextStatus,
          events: {
            create: {
              companyId: message.companyId,
              status: nextStatus,
              raw: statusEvent as Prisma.InputJsonValue,
              dedupeKey: eventDedupeKey,
            },
          },
        },
      });

      await updateBulkMessageRecipientTracking(
        updatedMessage.id,
        nextStatus,
        nextStatus === "FAILED" ? "Meta reported delivery failure" : undefined,
      );

      await enqueueDeveloperMessageStatusWebhook(
        updatedMessage.companyId,
        updatedMessage.id,
      );

      if (
        updatedMessage.campaignContactId &&
        ["DELIVERED", "READ", "FAILED"].includes(nextStatus)
      ) {
        await prisma.campaignContact.update({
          where: {
            id: updatedMessage.campaignContactId,
          },
          data: {
            status:
              nextStatus === "DELIVERED"
                ? "DELIVERED"
                : nextStatus === "READ"
                  ? "READ"
                  : "FAILED",
          },
        });
      }

      if (updatedMessage.campaignId) {
        if (nextStatus === "DELIVERED") {
          await prisma.campaign.update({
            where: {
              id: updatedMessage.campaignId,
            },
            data: {
              deliveredCount: {
                increment: 1,
              },
            },
          });
        }

        if (nextStatus === "READ") {
          await prisma.campaign.update({
            where: {
              id: updatedMessage.campaignId,
            },
            data: {
              readCount: {
                increment: 1,
              },
            },
          });
        }

        if (nextStatus === "FAILED") {
          await prisma.campaign.update({
            where: {
              id: updatedMessage.campaignId,
            },
            data: {
              failedCount: {
                increment: 1,
              },
            },
          });
        }
      }
    }

    await prisma.webhookEvent.update({
      where: {
        id: webhookEvent.id,
      },
      data: {
        status: "PROCESSED",
      },
    });

    console.log("Webhook processed:", webhookEvent.id);
  },
  {
    connection: getRedisConnection(),
  },
);

void heartbeat.start();

worker.on("completed", (job) => {
  console.log(`Webhook job completed: ${job.id}`);
});

worker.on("failed", async (job, error) => {
  console.error(`Webhook job failed: ${job?.id}`, error);
  await heartbeat.markError(error);

  if (job?.data.webhookEventId) {
    await prisma.webhookEvent.update({
      where: {
        id: job.data.webhookEventId,
      },
      data: {
        status: "FAILED",
      },
    });
  }
});

async function shutdown() {
  await worker.close();
  await heartbeat.stop();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

console.log("Webhook worker is running...");
