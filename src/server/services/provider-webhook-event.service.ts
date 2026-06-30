import crypto from "node:crypto";
import { Prisma, ProviderWebhookProvider } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export function sha256Text(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function getMetaWebhookEventId(body: unknown) {
  const root = asRecord(body);
  const entries = asArray(root.entry);

  const ids: string[] = [];

  for (const entry of entries) {
    const entryRecord = asRecord(entry);
    const changes = asArray(entryRecord.changes);

    for (const change of changes) {
      const changeRecord = asRecord(change);
      const value = asRecord(changeRecord.value);

      for (const message of asArray(value.messages)) {
        const messageRecord = asRecord(message);
        const id = messageRecord.id;

        if (typeof id === "string" && id) {
          ids.push(`message:${id}`);
        }
      }

      for (const status of asArray(value.statuses)) {
        const statusRecord = asRecord(status);
        const id = statusRecord.id;
        const statusValue = statusRecord.status;

        if (typeof id === "string" && id) {
          ids.push(`status:${id}:${String(statusValue ?? "")}`);
        }
      }
    }
  }

  return ids.length > 0 ? ids.sort().join("|") : null;
}

export function getMetaWebhookEventType(body: unknown) {
  const root = asRecord(body);
  const entries = asArray(root.entry);

  for (const entry of entries) {
    const entryRecord = asRecord(entry);
    const changes = asArray(entryRecord.changes);

    for (const change of changes) {
      const changeRecord = asRecord(change);
      const field = changeRecord.field;

      if (typeof field === "string" && field) {
        return field;
      }
    }
  }

  return "whatsapp";
}

export function getCashfreeWebhookEventId({
  body,
  eventIdHeader,
}: {
  body: unknown;
  eventIdHeader?: string | null;
}) {
  if (eventIdHeader) {
    return eventIdHeader;
  }

  const root = asRecord(body);
  const eventName = typeof root.event === "string" ? root.event : "unknown";
  const createdAt = root.created_at ? String(root.created_at) : "";

  const payload = asRecord(root.payload);
  const payment = asRecord(asRecord(payload.payment).entity);
  const order = asRecord(asRecord(payload.order).entity);
  const subscription = asRecord(asRecord(payload.subscription).entity);

  const entityId =
    payment.id ?? order.id ?? subscription.id ?? root.id ?? createdAt;

  return `${eventName}:${String(entityId)}`;
}

export function getCashfreeWebhookEventType(body: unknown) {
  const root = asRecord(body);

  return typeof root.event === "string" ? root.event : "cashfree.webhook";
}

export async function startProviderWebhookEvent({
  provider,
  providerEventId,
  eventType,
  rawBody,
  metadata,
}: {
  provider: ProviderWebhookProvider;
  providerEventId?: string | null;
  eventType?: string | null;
  rawBody: string;
  metadata?: Prisma.InputJsonValue;
}) {
  const bodySha256 = sha256Text(rawBody);
  const now = new Date();

  try {
    const event = await prisma.providerWebhookEvent.create({
      data: {
        provider,
        providerEventId: providerEventId ?? bodySha256,
        eventType,
        bodySha256,
        status: "PROCESSING",
        processingStartedAt: now,
        metadata,
      },
    });

    return {
      event,
      shouldProcess: true,
      duplicate: false,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existingEvent =
        (providerEventId
          ? await prisma.providerWebhookEvent.findFirst({
              where: {
                provider,
                providerEventId,
              },
            })
          : null) ??
        (await prisma.providerWebhookEvent.findFirst({
          where: {
            provider,
            bodySha256,
          },
        }));

      if (!existingEvent) {
        throw error;
      }

      if (existingEvent.status === "FAILED") {
        const retryEvent = await prisma.providerWebhookEvent.update({
          where: {
            id: existingEvent.id,
          },
          data: {
            status: "PROCESSING",
            attempts: {
              increment: 1,
            },
            processingStartedAt: now,
            lastErrorMessage: null,
            lastDuplicateSeenAt: now,
          },
        });

        return {
          event: retryEvent,
          shouldProcess: true,
          duplicate: true,
        };
      }

      const duplicateEvent = await prisma.providerWebhookEvent.update({
        where: {
          id: existingEvent.id,
        },
        data: {
          lastDuplicateSeenAt: now,
        },
      });

      return {
        event: duplicateEvent,
        shouldProcess: false,
        duplicate: true,
      };
    }

    throw error;
  }
}

export async function completeProviderWebhookEvent({
  eventId,
}: {
  eventId: string;
}) {
  return prisma.providerWebhookEvent.update({
    where: {
      id: eventId,
    },
    data: {
      status: "SUCCEEDED",
      processedAt: new Date(),
      lastErrorMessage: null,
    },
  });
}

export async function failProviderWebhookEvent({
  eventId,
  errorMessage,
}: {
  eventId: string;
  errorMessage: string;
}) {
  return prisma.providerWebhookEvent.update({
    where: {
      id: eventId,
    },
    data: {
      status: "FAILED",
      processedAt: new Date(),
      lastErrorMessage: errorMessage.slice(0, 2000),
    },
  });
}

export async function getProviderWebhookEventHealth() {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    total24h,
    failed24h,
    processingStale,
    duplicateSeen24h,
    recentEvents,
  ] = await Promise.all([
    prisma.providerWebhookEvent.count({
      where: {
        receivedAt: {
          gte: since24h,
        },
      },
    }),
    prisma.providerWebhookEvent.count({
      where: {
        status: "FAILED",
        receivedAt: {
          gte: since24h,
        },
      },
    }),
    prisma.providerWebhookEvent.count({
      where: {
        status: "PROCESSING",
        processingStartedAt: {
          lt: new Date(Date.now() - 15 * 60 * 1000),
        },
      },
    }),
    prisma.providerWebhookEvent.count({
      where: {
        lastDuplicateSeenAt: {
          gte: since24h,
        },
      },
    }),
    prisma.providerWebhookEvent.findMany({
      orderBy: {
        receivedAt: "desc",
      },
      take: 20,
    }),
  ]);

  return {
    isHealthy: failed24h === 0 && processingStale === 0,
    total24h,
    failed24h,
    processingStale,
    duplicateSeen24h,
    recentEvents,
  };
}
