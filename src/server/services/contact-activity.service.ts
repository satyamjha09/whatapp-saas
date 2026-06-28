import { ContactActivityType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { redactSensitiveData } from "@/server/utils/safe-logger";

export async function recordContactActivity({
  companyId,
  contactId,
  actorUserId,
  type,
  title,
  description,
  metadata,
  dedupeKey,
  createdAt,
}: {
  companyId: string;
  contactId: string;
  actorUserId?: string | null;
  type: ContactActivityType;
  title: string;
  description?: string | null;
  metadata?: unknown;
  dedupeKey?: string | null;
  createdAt?: Date;
}) {
  const data = {
    companyId,
    contactId,
    actorUserId: actorUserId ?? null,
    type,
    title,
    description: description ?? null,
    dedupeKey: dedupeKey ?? null,
    metadata:
      metadata !== undefined
        ? (redactSensitiveData(metadata) as Prisma.InputJsonValue)
        : undefined,
    ...(createdAt ? { createdAt } : {}),
  };

  if (dedupeKey) {
    return prisma.contactActivity.upsert({
      where: {
        dedupeKey,
      },
      create: data,
      update: {
        actorUserId: data.actorUserId,
        description: data.description,
        metadata: data.metadata,
        title: data.title,
        type: data.type,
      },
    });
  }

  return prisma.contactActivity.create({
    data: {
      ...data,
      dedupeKey: null,
    },
  });
}

export async function getContactTimeline({
  companyId,
  contactId,
  take = 100,
}: {
  companyId: string;
  contactId: string;
  take?: number;
}) {
  const [activities, messages, notes] = await Promise.all([
    prisma.contactActivity.findMany({
      where: {
        companyId,
        contactId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),

    prisma.message.findMany({
      where: {
        companyId,
        contactId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take,
      select: {
        id: true,
        direction: true,
        status: true,
        body: true,
        createdAt: true,
      },
    }),

    prisma.inboxNote.findMany({
      where: {
        companyId,
        contactId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
  ]);

  const timeline = [
    ...activities.map((activity) => ({
      id: `activity:${activity.id}`,
      sourceId: activity.id,
      kind: "ACTIVITY" as const,
      type: activity.type,
      title: activity.title,
      description: activity.description,
      actorName: activity.actor?.name ?? activity.actor?.email ?? null,
      createdAt: activity.createdAt,
      metadata: activity.metadata,
    })),

    ...messages.map((message) => ({
      id: `message:${message.id}`,
      sourceId: message.id,
      kind: "MESSAGE" as const,
      type:
        message.direction === "INBOUND"
          ? "MESSAGE_INBOUND"
          : "MESSAGE_OUTBOUND",
      title:
        message.direction === "INBOUND"
          ? "Inbound message"
          : `Outbound message - ${message.status}`,
      description: message.body,
      actorName: null,
      createdAt: message.createdAt,
      metadata: {
        status: message.status,
        direction: message.direction,
      },
    })),

    ...notes.map((note) => ({
      id: `note:${note.id}`,
      sourceId: note.id,
      kind: "NOTE" as const,
      type: "NOTE_CREATED",
      title: "Internal note",
      description: note.body,
      actorName: note.author?.name ?? note.author?.email ?? null,
      createdAt: note.createdAt,
      metadata: null,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return timeline.slice(0, take);
}
