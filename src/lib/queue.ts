import { Queue } from "bullmq";
import { getRedisConnection } from "@/lib/redis";

export const DEFAULT_MESSAGE_JOB_ATTEMPTS = 10;

let messageQueue: Queue | undefined;
let webhookQueue: Queue | undefined;
let developerWebhookQueue: Queue | undefined;
let maintenanceQueue: Queue | undefined;

export function getMessageQueue() {
  messageQueue ??= new Queue("message-queue", {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: DEFAULT_MESSAGE_JOB_ATTEMPTS,
      backoff: {
        type: "exponential",
        delay: 60_000,
      },
      removeOnComplete: {
        age: 24 * 60 * 60,
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 60 * 60,
        count: 1000,
      },
    },
  });

  return messageQueue;
}

export function getWebhookQueue() {
  webhookQueue ??= new Queue("webhook-queue", {
    connection: getRedisConnection(),
  });

  return webhookQueue;
}

export function getDeveloperWebhookQueue() {
  developerWebhookQueue ??= new Queue("developer-webhook-queue", {
    connection: getRedisConnection(),
  });

  return developerWebhookQueue;
}

export function getMaintenanceQueue() {
  maintenanceQueue ??= new Queue("maintenance-queue", {
    connection: getRedisConnection(),
  });

  return maintenanceQueue;
}

export type SendMessageJobData = {
  messageId: string;
  companyId: string;
};

export type ProcessWebhookJobData = {
  webhookEventId: string;
};

export type DeliverDeveloperWebhookJobData = {
  deliveryId: string;
};
