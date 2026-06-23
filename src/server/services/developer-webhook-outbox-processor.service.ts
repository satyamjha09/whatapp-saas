import { prisma } from "@/lib/prisma";
import { createCompanyNotification } from "@/server/services/company-notification.service";
import { enqueueDeveloperWebhookDeliveries } from "@/server/services/developer-webhook.service";

export async function processDeveloperWebhookOutboxEvent(
  outboxEventId: string,
) {
  const claimed = await prisma.developerWebhookOutbox.updateMany({
    where: {
      id: outboxEventId,
      status: { in: ["PENDING", "FAILED"] },
    },
    data: {
      status: "PROCESSING",
      attempts: { increment: 1 },
      lockedAt: new Date(),
      lastError: null,
    },
  });

  if (claimed.count === 0) {
    return { skipped: true, reason: "Already processing or delivered" };
  }

  const outboxEvent = await prisma.developerWebhookOutbox.findUnique({
    where: { id: outboxEventId },
  });

  if (!outboxEvent) {
    return { skipped: true, reason: "Outbox event not found" };
  }

  try {
    await enqueueDeveloperWebhookDeliveries({
      companyId: outboxEvent.companyId,
      eventType: outboxEvent.eventType,
      payload: outboxEvent.payload as Record<string, unknown>,
      outboxEventId: outboxEvent.id,
    });

    const updatedEvent = await prisma.developerWebhookOutbox.update({
      where: { id: outboxEvent.id },
      data: {
        status: "DELIVERED",
        processedAt: new Date(),
        lockedAt: null,
        lastError: null,
      },
    });

    return { delivered: true, outboxEventId: updatedEvent.id };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown webhook publish error";

    await prisma.developerWebhookOutbox.update({
      where: { id: outboxEvent.id },
      data: {
        status: "FAILED",
        lockedAt: null,
        lastError: errorMessage.slice(0, 1_000),
      },
    });

    await createCompanyNotification({
      companyId: outboxEvent.companyId,
      type: "WEBHOOK",
      severity: "ERROR",
      title: "Webhook outbox event failed",
      message: `${outboxEvent.eventType} failed after webhook delivery retries.`,
      actionHref: `/dashboard/developer/webhooks/outbox/${outboxEvent.id}`,
      idempotencyKey: `webhook-outbox-failed:${outboxEvent.id}`,
      metadata: {
        outboxEventId: outboxEvent.id,
        eventType: outboxEvent.eventType,
        errorMessage,
      },
    });

    throw error;
  }
}
