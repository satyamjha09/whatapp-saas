import { Queue } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "@/lib/prisma";
import { DEVELOPER_WEBHOOK_OUTBOX_QUEUE } from "@/server/queues/developer-webhook-outbox.queue";
import { NOTIFICATION_EMAIL_QUEUE } from "@/server/queues/notification-email.queue";
import { getDatabaseBackupHealth } from "@/server/services/database-backup.service";
import { getWorkerHeartbeatHealth } from "@/server/services/worker-heartbeat.service";

type QueueHealth = {
  name: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
  paused: boolean;
  isHealthy: boolean;
  error: string | null;
};

function createQueueConnection() {
  return new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    connectTimeout: 1000,
    maxRetriesPerRequest: null,
  });
}

async function getQueueHealth(queue: Queue): Promise<QueueHealth> {
  try {
    const [counts, paused] = await Promise.all([
      queue.getJobCounts("waiting", "active", "delayed", "failed", "completed"),
      queue.isPaused(),
    ]);

    const waiting = counts.waiting ?? 0;
    const active = counts.active ?? 0;
    const delayed = counts.delayed ?? 0;
    const failed = counts.failed ?? 0;
    const completed = counts.completed ?? 0;

    return {
      name: queue.name,
      waiting,
      active,
      delayed,
      failed,
      completed,
      paused,
      isHealthy: !paused && failed < 20 && waiting < 1000,
      error: null,
    };
  } catch (error) {
    return {
      name: queue.name,
      waiting: 0,
      active: 0,
      delayed: 0,
      failed: 0,
      completed: 0,
      paused: false,
      isHealthy: false,
      error:
        error instanceof Error ? error.message : "Unable to read queue health",
    };
  }
}

export async function getRedisHealth() {
  const redis = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    connectTimeout: 1000,
    maxRetriesPerRequest: 1,
  });

  try {
    const startedAt = Date.now();
    const pong = await redis.ping();

    return {
      ok: pong === "PONG",
      latencyMs: Date.now() - startedAt,
      error: null as string | null,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: null,
      error: error instanceof Error ? error.message : "Redis ping failed",
    };
  } finally {
    redis.disconnect();
  }
}

export async function getDatabaseHealth() {
  try {
    const startedAt = Date.now();

    await prisma.$queryRaw`SELECT 1`;

    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
      error: null as string | null,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: null,
      error: error instanceof Error ? error.message : "Database check failed",
    };
  }
}

export async function getOperationsHealth() {
  const queueNames = [
    "message-queue",
    "webhook-queue",
    "developer-webhook-queue",
    "maintenance-queue",
    DEVELOPER_WEBHOOK_OUTBOX_QUEUE,
    NOTIFICATION_EMAIL_QUEUE,
  ];

  const queues = queueNames.map(
    (queueName) =>
      new Queue(queueName, {
        connection: createQueueConnection(),
      }),
  );

  try {
    const [
      redis,
      database,
      queueHealth,
      workerHeartbeats,
      databaseBackups,
      recentJobs,
    ] =
      await Promise.all([
        getRedisHealth(),
        getDatabaseHealth(),
        Promise.all(queues.map((queue) => getQueueHealth(queue))),
        getWorkerHeartbeatHealth({
          staleAfterSeconds: 120,
        }),
        getDatabaseBackupHealth(),
        prisma.maintenanceJobRun.findMany({
          orderBy: {
            startedAt: "desc",
          },
          take: 20,
        }),
      ]);

    const isHealthy =
      redis.ok &&
      database.ok &&
      databaseBackups.isHealthy &&
      queueHealth.every((queue) => queue.isHealthy) &&
      workerHeartbeats.unhealthyWorkers.length === 0 &&
      recentJobs.filter((job) => job.status === "FAILED").length < 5;

    return {
      isHealthy,
      redis,
      database,
      databaseBackups,
      queues: queueHealth,
      workerHeartbeats,
      recentJobs,
    };
  } finally {
    await Promise.allSettled(queues.map((queue) => queue.close()));
  }
}
