import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getRedisConnection } from "@/lib/redis";
import type { DeveloperWebhookEvent } from "@/server/config/developer-webhook-events";
import { getDeveloperWebhookOutboxQueue } from "@/server/queues/developer-webhook-outbox.queue";

export async function enqueueDeveloperWebhookOutboxEvent(
  outboxEventId: string,
) {
  const connection = getRedisConnection();

  if (connection.status !== "ready") {
    return false;
  }

  const queue = getDeveloperWebhookOutboxQueue();
  await queue.add(
    "deliver-developer-webhook-event",
    { outboxEventId },
    {
      jobId: outboxEventId,
      attempts: 5,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: { age: 24 * 60 * 60, count: 500 },
      removeOnFail: true,
    },
  );

  return true;
}

export async function publishDeveloperWebhookEvent({
  companyId,
  eventType,
  payload,
  idempotencyKey,
}: {
  companyId: string;
  eventType: DeveloperWebhookEvent;
  payload: Prisma.InputJsonValue;
  idempotencyKey?: string;
}) {
  const outboxEvent = idempotencyKey
    ? await prisma.developerWebhookOutbox.upsert({
        where: {
          companyId_idempotencyKey: { companyId, idempotencyKey },
        },
        update: {},
        create: { companyId, eventType, payload, idempotencyKey },
      })
    : await prisma.developerWebhookOutbox.create({
        data: { companyId, eventType, payload },
      });

  if (outboxEvent.status !== "DELIVERED") {
    try {
      await enqueueDeveloperWebhookOutboxEvent(outboxEvent.id);
    } catch (error) {
      console.error("DEVELOPER_WEBHOOK_OUTBOX_ENQUEUE_ERROR:", error);
    }
  }

  return outboxEvent;
}

export async function enqueueRecoverableDeveloperWebhookOutboxEvents() {
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000);

  await prisma.developerWebhookOutbox.updateMany({
    where: { status: "PROCESSING", lockedAt: { lt: staleBefore } },
    data: { status: "PENDING", lockedAt: null },
  });

  const events = await prisma.developerWebhookOutbox.findMany({
    where: { status: { in: ["PENDING", "FAILED"] } },
    orderBy: { createdAt: "asc" },
    take: 1_000,
    select: { id: true },
  });

  for (const event of events) {
    await enqueueDeveloperWebhookOutboxEvent(event.id);
  }

  return events.length;
}
