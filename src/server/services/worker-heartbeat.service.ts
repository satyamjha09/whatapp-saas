import crypto from "crypto";
import os from "os";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000;
const EXPECTED_WORKER_NAMES = [
  "message-worker",
  "bulk-message-worker",
  "webhook-worker",
  "developer-webhook-worker",
  "developer-webhook-outbox-worker",
  "inbox-sla-worker",
  "maintenance-worker",
  "notification-email-worker",
  "campaign-launch-worker",
  "campaign-sequence-worker",
  "template-status-sync-worker",
  "automation-runtime-worker",
];

export function createWorkerHeartbeat({
  workerName,
  intervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS,
  metadata,
}: {
  workerName: string;
  intervalMs?: number;
  metadata?: Prisma.InputJsonValue;
}) {
  const instanceId = `${workerName}:${os.hostname()}:${process.pid}:${crypto.randomUUID()}`;

  let timer: NodeJS.Timeout | null = null;

  async function beat() {
    await prisma.systemWorkerHeartbeat.upsert({
      where: {
        instanceId,
      },
      update: {
        status: "RUNNING",
        lastHeartbeatAt: new Date(),
        lastError: null,
        metadata,
      },
      create: {
        workerName,
        instanceId,
        status: "RUNNING",
        hostname: os.hostname(),
        processId: process.pid,
        lastHeartbeatAt: new Date(),
        startedAt: new Date(),
        metadata,
      },
    });
  }

  async function start() {
    await beat();

    timer = setInterval(() => {
      beat().catch((error) => {
        console.error(`WORKER_HEARTBEAT_ERROR:${workerName}`, error);
      });
    }, intervalMs);
  }

  async function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }

    await prisma.systemWorkerHeartbeat.updateMany({
      where: {
        instanceId,
      },
      data: {
        status: "STOPPED",
        stoppedAt: new Date(),
      },
    });
  }

  async function markError(error: unknown) {
    await prisma.systemWorkerHeartbeat.updateMany({
      where: {
        instanceId,
      },
      data: {
        status: "ERROR",
        lastHeartbeatAt: new Date(),
        lastError:
          error instanceof Error
            ? error.message.slice(0, 1000)
            : "Unknown worker error",
      },
    });
  }

  return {
    instanceId,
    start,
    stop,
    markError,
  };
}

export async function getWorkerHeartbeatHealth({
  staleAfterSeconds = 120,
}: {
  staleAfterSeconds?: number;
} = {}) {
  const staleBefore = new Date(Date.now() - staleAfterSeconds * 1000);

  const heartbeats = await prisma.systemWorkerHeartbeat.findMany({
    orderBy: {
      lastHeartbeatAt: "desc",
    },
    take: 100,
  });

  const workers = heartbeats.map((heartbeat) => {
    const isStale =
      heartbeat.status === "RUNNING" &&
      heartbeat.lastHeartbeatAt < staleBefore;

    return {
      ...heartbeat,
      isStale,
      isHealthy: heartbeat.status === "RUNNING" && !isStale,
    };
  });

  const latestWorkerByName = new Map<
    string,
    (typeof workers)[number] | undefined
  >();

  for (const worker of workers) {
    if (!latestWorkerByName.has(worker.workerName)) {
      latestWorkerByName.set(worker.workerName, worker);
    }
  }

  const expectedWorkers = EXPECTED_WORKER_NAMES.map((workerName) => {
    const worker = latestWorkerByName.get(workerName);

    if (!worker) {
      return {
        workerName,
        instanceId: null,
        status: "MISSING" as const,
        hostname: null,
        processId: null,
        lastHeartbeatAt: null,
        lastError: null,
        isMissing: true,
        isStale: false,
        isHealthy: false,
      };
    }

    return {
      workerName,
      instanceId: worker.instanceId,
      status: worker.status,
      hostname: worker.hostname,
      processId: worker.processId,
      lastHeartbeatAt: worker.lastHeartbeatAt,
      lastError: worker.lastError,
      isMissing: false,
      isStale: worker.isStale,
      isHealthy: worker.isHealthy,
    };
  });

  return {
    staleAfterSeconds,
    workers,
    expectedWorkers,
    missingWorkers: expectedWorkers.filter((worker) => worker.isMissing),
    staleWorkers: workers.filter((worker) => worker.isStale),
    unhealthyWorkers: expectedWorkers.filter((worker) => !worker.isHealthy),
  };
}
