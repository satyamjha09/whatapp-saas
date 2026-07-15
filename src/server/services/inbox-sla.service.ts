import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  calculateInboxSlaTimers,
  recordInboxSlaEvent,
} from "@/server/services/inbox-sla-policy.service";

type InboxPriorityValue = "LOW" | "NORMAL" | "HIGH" | "URGENT";

const SLA_MINUTES_BY_PRIORITY: Record<InboxPriorityValue, number> = {
  URGENT: 15,
  HIGH: 60,
  NORMAL: 240,
  LOW: 1440,
};

export function calculateInboxSlaDueAt(
  priority: InboxPriorityValue,
  fromDate = new Date(),
) {
  const minutes = SLA_MINUTES_BY_PRIORITY[priority];

  return new Date(fromDate.getTime() + minutes * 60 * 1000);
}

export function isInboxSlaOverdue(dueAt: Date | null, now = new Date()) {
  if (!dueAt) {
    return false;
  }

  return dueAt.getTime() < now.getTime();
}

export function isInboxSlaDueSoon(dueAt: Date | null, now = new Date()) {
  if (!dueAt) {
    return false;
  }

  const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);

  return dueAt.getTime() >= now.getTime() && dueAt <= thirtyMinutesFromNow;
}

function getSoonestDate(...dates: Array<Date | null | undefined>) {
  return dates
    .filter((date): date is Date => date instanceof Date)
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
}

export async function setInboxSlaTimersForInbound(input: {
  companyId: string;
  contactId: string;
  from?: Date;
  metadata?: Prisma.InputJsonValue;
}) {
  const now = input.from ?? new Date();
  const contact = await prisma.contact.findFirst({
    where: {
      id: input.contactId,
      companyId: input.companyId,
    },
    select: {
      id: true,
      companyId: true,
      inboxQueueId: true,
      inboxPriority: true,
      inboxStatus: true,
      inboxFirstRespondedAt: true,
      inboxResolutionDueAt: true,
      inboxResolvedAt: true,
    },
  });

  if (!contact) {
    return null;
  }

  const needsFirstResponse = !contact.inboxFirstRespondedAt;
  const timers = await calculateInboxSlaTimers({
    companyId: contact.companyId,
    queueId: contact.inboxQueueId,
    priority: contact.inboxPriority,
    from: now,
    needsFirstResponse,
    needsResolution: !contact.inboxResolutionDueAt || contact.inboxResolvedAt !== null,
  });
  const resolutionDueAt = timers.resolutionDueAt ?? contact.inboxResolutionDueAt;
  const legacyDueAt = getSoonestDate(
    timers.firstResponseDueAt,
    timers.nextResponseDueAt,
  );

  const updated = await prisma.contact.update({
    where: { id: contact.id },
    data: {
      inboxStatus: "OPEN",
      inboxClosedAt: null,
      inboxResolvedAt: null,
      inboxLastCustomerMessageAt: now,
      inboxFirstResponseDueAt: timers.firstResponseDueAt,
      inboxNextResponseDueAt: timers.nextResponseDueAt,
      inboxResolutionDueAt: resolutionDueAt,
      inboxSlaDueAt: legacyDueAt,
      inboxSlaBreachedAt: null,
      inboxSlaEscalationCount: 0,
      snoozedUntil: null,
      snoozeReason: null,
      snoozedByUserId: null,
      snoozedAt: null,
      inboxSlaPausedAt: null,
    },
  });

  await recordInboxSlaEvent({
    companyId: contact.companyId,
    contactId: contact.id,
    queueId: contact.inboxQueueId,
    policyId: timers.policy.id,
    type: "TIMER_SET",
    dueAt: legacyDueAt,
    metadata: {
      source: "inbound_message",
      needsFirstResponse,
      firstResponseDueAt: timers.firstResponseDueAt?.toISOString() ?? null,
      nextResponseDueAt: timers.nextResponseDueAt?.toISOString() ?? null,
      resolutionDueAt: resolutionDueAt?.toISOString() ?? null,
      ...(typeof input.metadata === "object" && input.metadata !== null
        ? input.metadata
        : {}),
    },
  });

  if (contact.inboxStatus === "CLOSED") {
    await recordInboxSlaEvent({
      companyId: contact.companyId,
      contactId: contact.id,
      queueId: contact.inboxQueueId,
      policyId: timers.policy.id,
      type: "REOPENED",
      metadata: {
        source: "inbound_message",
      },
    });
  }

  return updated;
}

export async function clearInboxSlaTimersForAgentReply(input: {
  companyId: string;
  contactId: string;
  actorUserId?: string | null;
  messageId?: string | null;
}) {
  const now = new Date();
  const contact = await prisma.contact.findFirst({
    where: {
      id: input.contactId,
      companyId: input.companyId,
    },
    select: {
      id: true,
      companyId: true,
      inboxQueueId: true,
      inboxFirstRespondedAt: true,
      inboxFirstResponseDueAt: true,
      inboxNextResponseDueAt: true,
    },
  });

  if (!contact) {
    return null;
  }

  const firstResponseCompleted = !contact.inboxFirstRespondedAt;

  const updated = await prisma.contact.update({
    where: { id: contact.id },
    data: {
      inboxFirstRespondedAt: contact.inboxFirstRespondedAt ?? now,
      inboxFirstResponseDueAt: null,
      inboxNextResponseDueAt: null,
      inboxSlaDueAt: null,
      inboxSlaBreachedAt: null,
    },
  });

  await recordInboxSlaEvent({
    companyId: contact.companyId,
    contactId: contact.id,
    queueId: contact.inboxQueueId,
    actorUserId: input.actorUserId ?? null,
    type: "RESPONDED",
    metadata: {
      source: "agent_reply",
      messageId: input.messageId ?? null,
      firstResponseCompleted,
      previousFirstResponseDueAt:
        contact.inboxFirstResponseDueAt?.toISOString() ?? null,
      previousNextResponseDueAt: contact.inboxNextResponseDueAt?.toISOString() ?? null,
    },
  });

  return updated;
}

export async function markInboxConversationResolved(input: {
  companyId: string;
  contactId: string;
  actorUserId?: string | null;
}) {
  const now = new Date();
  const contact = await prisma.contact.findFirst({
    where: {
      id: input.contactId,
      companyId: input.companyId,
    },
    select: {
      id: true,
      companyId: true,
      inboxQueueId: true,
    },
  });

  if (!contact) {
    return null;
  }

  const updated = await prisma.contact.update({
    where: { id: contact.id },
    data: {
      inboxResolvedAt: now,
      inboxResolutionDueAt: null,
      inboxSlaDueAt: null,
      inboxSlaBreachedAt: null,
      inboxSlaEscalationCount: 0,
    },
  });

  await recordInboxSlaEvent({
    companyId: contact.companyId,
    contactId: contact.id,
    queueId: contact.inboxQueueId,
    actorUserId: input.actorUserId ?? null,
    type: "RESOLVED",
    metadata: {
      source: "conversation_status",
    },
  });

  return updated;
}
