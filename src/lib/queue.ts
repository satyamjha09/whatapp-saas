import { Queue } from "bullmq";
import { getRedisConnection } from "@/lib/redis";

let messageQueue: Queue | undefined;
let webhookQueue: Queue | undefined;
let developerWebhookQueue: Queue | undefined;
let maintenanceQueue: Queue | undefined;

export function getMessageQueue() {
  messageQueue ??= new Queue("message-queue", {
    connection: getRedisConnection(),
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
