import { Queue } from "bullmq";
import { getRedisConnection } from "@/lib/redis";

export const DEVELOPER_WEBHOOK_OUTBOX_QUEUE = "developer-webhook-outbox";

let outboxQueue: Queue | undefined;

export function getDeveloperWebhookOutboxConnection() {
  return getRedisConnection();
}

export function getDeveloperWebhookOutboxQueue() {
  outboxQueue ??= new Queue(DEVELOPER_WEBHOOK_OUTBOX_QUEUE, {
    connection: getDeveloperWebhookOutboxConnection(),
  });

  return outboxQueue;
}
