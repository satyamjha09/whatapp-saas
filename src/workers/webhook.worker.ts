import "dotenv/config";
import { Worker } from "bullmq";
import { redisConnection } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { enqueueDeveloperMessageStatusWebhook } from "@/server/services/developer-webhook.service";
import type { Prisma } from "@/generated/prisma/client";
import type { MessageStatus } from "@/generated/prisma/enums";
import type { ProcessWebhookJobData } from "@/lib/queue";

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
    connection: redisConnection,
  },
);

worker.on("completed", (job) => {
  console.log(`Webhook job completed: ${job.id}`);
});

worker.on("failed", async (job, error) => {
  console.error(`Webhook job failed: ${job?.id}`, error);

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

console.log("Webhook worker is running...");
