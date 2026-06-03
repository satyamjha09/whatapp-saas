import { Queue } from "bullmq";
import { redisConnection } from "@/lib/redis";

export const messageQueue = new Queue("message-queue", {
  connection: redisConnection,
});

export const webhookQueue = new Queue("webhook-queue", {
  connection: redisConnection,
});

export const developerWebhookQueue = new Queue("developer-webhook-queue", {
  connection: redisConnection,
});

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
