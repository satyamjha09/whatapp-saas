import { DeadLetterJobStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { REGISTERED_QUEUES } from "@/server/config/queue-registry";
import { getBullQueue } from "@/server/services/bullmq-queue.service";
import { createIncident } from "@/server/services/incident.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";

function isEnabled() {
  return process.env.DEAD_LETTER_QUEUE_ENABLED !== "false";
}

function getSyncLimit() {
  const parsed = Number(process.env.DEAD_LETTER_QUEUE_SYNC_LIMIT ?? 100);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 100;
}

function safeJson(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

export async function syncFailedJobsForQueue(queueName: string) {
  if (!isEnabled()) {
    return { queueName, synced: 0, skipped: true };
  }

  const queue = getBullQueue(queueName);
  let synced = 0;

  try {
    const limit = getSyncLimit();
    const failedJobs = await queue.getFailed(0, limit - 1);

    for (const job of failedJobs) {
      if (job.id === undefined) continue;

      const jobId = String(job.id);
      const failedAt = job.finishedOn ? new Date(job.finishedOn) : new Date();
      const existing = await prisma.deadLetterJob.findUnique({
        where: { queueName_jobId: { queueName, jobId } },
        select: { status: true },
      });

      const failureData = {
        jobName: job.name,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason ?? null,
        stacktrace: job.stacktrace ?? [],
        payload: safeJson(job.data),
        returnValue: safeJson(job.returnvalue),
        lastFailedAt: failedAt,
      };

      await prisma.deadLetterJob.upsert({
        where: { queueName_jobId: { queueName, jobId } },
        create: {
          queueName,
          jobId,
          status: "FAILED",
          firstFailedAt: failedAt,
          ...failureData,
        },
        update: {
          ...failureData,
          // Dismissed jobs stay dismissed while they remain in BullMQ's failed set.
          ...(existing?.status === "IGNORED"
            ? {}
            : { status: "FAILED" as const, resolvedAt: null }),
        },
      });

      synced += 1;
    }
  } finally {
    await queue.close();
  }

  if (synced > 0) {
    await createIncident({
      title: `Failed jobs detected in ${queueName}`,
      description: `${synced} failed job(s) were found in BullMQ queue "${queueName}".`,
      source: "WORKER",
      severity: synced >= 10 ? "HIGH" : "MEDIUM",
      idempotencyKey: `dead-letter-queue:${queueName}`,
      metadata: {
        queueName,
        synced,
        deadLetterQueueHref: `/dashboard/system/dead-letter-queue?queue=${encodeURIComponent(queueName)}`,
      },
    }).catch(() => undefined);
  }

  return { queueName, synced, skipped: false };
}

export async function syncAllFailedQueueJobs() {
  const results = [];

  for (const queue of REGISTERED_QUEUES) {
    results.push(await syncFailedJobsForQueue(queue.name));
  }

  return results;
}

export async function getDeadLetterQueueSummary() {
  const [failed, retried, ignored, recent] = await Promise.all([
    prisma.deadLetterJob.count({ where: { status: "FAILED" } }),
    prisma.deadLetterJob.count({ where: { status: "RETRIED" } }),
    prisma.deadLetterJob.count({ where: { status: "IGNORED" } }),
    prisma.deadLetterJob.findMany({
      orderBy: { lastFailedAt: "desc" },
      take: 10,
    }),
  ]);

  return {
    enabled: isEnabled(),
    isHealthy: failed === 0,
    failed,
    retried,
    ignored,
    recent,
  };
}

export async function listDeadLetterJobs({
  status = "FAILED",
  queueName,
  take = 100,
}: {
  status?: DeadLetterJobStatus;
  queueName?: string;
  take?: number;
}) {
  return prisma.deadLetterJob.findMany({
    where: {
      status,
      ...(queueName ? { queueName } : {}),
    },
    orderBy: { lastFailedAt: "desc" },
    take: Math.min(Math.max(Math.floor(take), 1), 500),
  });
}

export async function getDeadLetterJobById(jobRecordId: string) {
  return prisma.deadLetterJob.findUnique({ where: { id: jobRecordId } });
}

export async function retryDeadLetterJob({
  jobRecordId,
  retriedByUserId,
}: {
  jobRecordId: string;
  retriedByUserId?: string | null;
}) {
  const record = await getDeadLetterJobById(jobRecordId);

  if (!record) throw new Error("Dead letter job not found");
  if (record.status !== "FAILED") {
    throw new Error("Only failed dead letter jobs can be retried");
  }

  const queue = getBullQueue(record.queueName);

  try {
    const job = await queue.getJob(record.jobId);

    if (!job) {
      await prisma.deadLetterJob.update({
        where: { id: jobRecordId },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          failedReason: "BullMQ job no longer exists in Redis",
        },
      });

      return {
        retried: false,
        resolved: true,
        reason: "Job no longer exists in Redis",
      };
    }

    const state = await job.getState();
    if (state !== "failed") {
      throw new Error(`BullMQ job cannot be retried from state "${state}"`);
    }

    await job.retry();

    await prisma.deadLetterJob.update({
      where: { id: jobRecordId },
      data: {
        status: "RETRIED",
        retriedAt: new Date(),
        retriedByUserId: retriedByUserId ?? null,
      },
    });

    return { retried: true, resolved: false };
  } finally {
    await queue.close();
  }
}

export async function ignoreDeadLetterJob({
  jobRecordId,
  ignoredByUserId,
  reason,
}: {
  jobRecordId: string;
  ignoredByUserId?: string | null;
  reason?: string | null;
}) {
  const record = await getDeadLetterJobById(jobRecordId);

  if (!record) throw new Error("Dead letter job not found");
  if (record.status !== "FAILED") {
    throw new Error("Only failed dead letter jobs can be ignored");
  }

  return prisma.deadLetterJob.update({
    where: { id: jobRecordId },
    data: {
      status: "IGNORED",
      ignoredAt: new Date(),
      ignoredByUserId: ignoredByUserId ?? null,
      ignoreReason: reason?.trim() || null,
    },
  });
}
