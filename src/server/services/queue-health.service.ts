import { Queue } from "bullmq";
import { getRedisConnection } from "@/lib/redis";
import {
  getAutomationRuntimeQueue,
  getAutomationMonitoringQueue,
  getDeveloperWebhookQueue,
  getLeadScoreQueue,
  getMaintenanceQueue,
  getMessageQueue,
  getWebhookQueue,
} from "@/lib/queue";
import { getDeveloperWebhookOutboxQueue } from "@/server/queues/developer-webhook-outbox.queue";
import { getNotificationEmailQueue } from "@/server/queues/notification-email.queue";

export type QueueHealthStatus = "HEALTHY" | "DEGRADED" | "UNHEALTHY";

export type QueueHealth = {
  queueName: string;
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
  oldestWaitingJobAgeMs?: number;
  oldestDelayedJobAgeMs?: number;
  status: QueueHealthStatus;
  error?: string;
};

function getQueueFactories() {
  return [
    { name: "message-queue", factory: getMessageQueue },
    { name: "webhook-queue", factory: getWebhookQueue },
    { name: "developer-webhook-queue", factory: getDeveloperWebhookQueue },
    { name: "developer-webhook-outbox", factory: getDeveloperWebhookOutboxQueue },
    { name: "automation-runtime-queue", factory: getAutomationRuntimeQueue },
    { name: "automation-monitoring-queue", factory: getAutomationMonitoringQueue },
    { name: "maintenance-queue", factory: getMaintenanceQueue },
    { name: "notification-email", factory: getNotificationEmailQueue },
    { name: "lead-score-queue", factory: getLeadScoreQueue },
  ];
}

async function getOldestJobAgeMs(queue: Queue, status: "waiting" | "delayed") {
  const jobs = await queue.getJobs([status], 0, 0, true);
  const timestamp = jobs[0]?.timestamp;

  if (!timestamp) return undefined;

  return Math.max(0, Date.now() - timestamp);
}

function deriveQueueStatus({
  failed,
  oldestDelayedJobAgeMs,
  oldestWaitingJobAgeMs,
}: {
  failed: number;
  oldestDelayedJobAgeMs?: number;
  oldestWaitingJobAgeMs?: number;
}): QueueHealthStatus {
  const oldestAgeMs = Math.max(
    oldestWaitingJobAgeMs ?? 0,
    oldestDelayedJobAgeMs ?? 0,
  );

  if (oldestAgeMs >= 30 * 60 * 1000 || failed >= 50) return "UNHEALTHY";
  if (oldestAgeMs >= 10 * 60 * 1000 || failed > 0) return "DEGRADED";

  return "HEALTHY";
}

export async function checkBullMQQueue(queue: Queue): Promise<QueueHealth> {
  try {
    const [counts, oldestWaitingJobAgeMs, oldestDelayedJobAgeMs] =
      await Promise.all([
        queue.getJobCounts("waiting", "active", "delayed", "completed", "failed"),
        getOldestJobAgeMs(queue, "waiting"),
        getOldestJobAgeMs(queue, "delayed"),
      ]);

    const waiting = counts.waiting ?? 0;
    const active = counts.active ?? 0;
    const delayed = counts.delayed ?? 0;
    const completed = counts.completed ?? 0;
    const failed = counts.failed ?? 0;

    return {
      queueName: queue.name,
      waiting,
      active,
      delayed,
      completed,
      failed,
      oldestWaitingJobAgeMs,
      oldestDelayedJobAgeMs,
      status: deriveQueueStatus({
        failed,
        oldestDelayedJobAgeMs,
        oldestWaitingJobAgeMs,
      }),
    };
  } catch (error) {
    return {
      queueName: queue.name,
      waiting: 0,
      active: 0,
      delayed: 0,
      completed: 0,
      failed: 0,
      status: "UNHEALTHY",
      error: error instanceof Error ? error.message : "Unknown queue health error",
    };
  }
}

export async function getQueueHealth(queueName: string) {
  const item = getQueueFactories().find((queue) => queue.name === queueName);

  if (!item) {
    throw new Error(`Unknown queue: ${queueName}`);
  }

  return checkBullMQQueue(item.factory());
}

export async function getAllQueueHealth() {
  return Promise.all(
    getQueueFactories().map(async (queue) => checkBullMQQueue(queue.factory())),
  );
}

export async function getRedisHealth() {
  try {
    const redis = getRedisConnection();
    const pong = await redis.ping();

    return {
      ok: pong === "PONG",
      status: redis.status,
      error: null as string | null,
    };
  } catch (error) {
    return {
      ok: false,
      status: "unavailable",
      error: error instanceof Error ? error.message : "Unknown Redis error",
    };
  }
}
