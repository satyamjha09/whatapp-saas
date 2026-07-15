import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit.service";
import { createCompanyNotification } from "@/server/services/company-notification.service";
import {
  getInboxSlaPolicy,
  recordInboxSlaEvent,
} from "@/server/services/inbox-sla-policy.service";

type BreachType =
  | "FIRST_RESPONSE_BREACHED"
  | "NEXT_RESPONSE_BREACHED"
  | "RESOLUTION_BREACHED";

type EscalationAction = {
  type?: string;
  queueId?: string | null;
  userId?: string | null;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
};

type ProcessInboxSlaBreachesInput = {
  companyId?: string;
  limit?: number;
};

function isSnoozed(contact: { snoozedUntil: Date | null }, now: Date) {
  return Boolean(contact.snoozedUntil && contact.snoozedUntil > now);
}

function parseActions(raw: Prisma.JsonValue | null): EscalationAction[] {
  if (!raw || typeof raw !== "object") {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw.filter((item): item is EscalationAction => {
      return Boolean(item && typeof item === "object" && "type" in item);
    });
  }

  const maybeActions = (raw as { actions?: unknown }).actions;

  if (!Array.isArray(maybeActions)) {
    return [];
  }

  return maybeActions.filter((item): item is EscalationAction => {
    return Boolean(item && typeof item === "object" && "type" in item);
  });
}

async function hasSlaEvent(input: {
  companyId: string;
  contactId: string;
  type: string;
  dueAt: Date | null;
}) {
  const existing = await prisma.inboxSlaEvent.findFirst({
    where: {
      companyId: input.companyId,
      contactId: input.contactId,
      type: input.type as never,
      dueAt: input.dueAt,
    },
    select: { id: true },
  });

  return Boolean(existing);
}

async function notifySlaIssue(input: {
  companyId: string;
  contactId: string;
  title: string;
  message: string;
  severity: "WARNING" | "ERROR";
  idempotencyKey: string;
  metadata: Prisma.InputJsonValue;
}) {
  await createCompanyNotification({
    companyId: input.companyId,
    type: "INBOX",
    severity: input.severity,
    title: input.title,
    message: input.message,
    actionHref: `/dashboard/inbox/${input.contactId}`,
    idempotencyKey: input.idempotencyKey,
    metadata: input.metadata,
  });
}

async function applyEscalationActions(input: {
  companyId: string;
  contactId: string;
  actions: EscalationAction[];
}) {
  let applied = 0;

  for (const action of input.actions) {
    if (action.type === "RAISE_PRIORITY") {
      await prisma.contact.updateMany({
        where: { id: input.contactId, companyId: input.companyId },
        data: { inboxPriority: action.priority ?? "URGENT" },
      });
      applied += 1;
    }

    if (action.type === "REASSIGN_QUEUE" && action.queueId) {
      await prisma.contact.updateMany({
        where: { id: input.contactId, companyId: input.companyId },
        data: {
          inboxQueueId: action.queueId,
          inboxAssignmentSource: "SYSTEM",
          inboxAssignmentVersion: { increment: 1 },
        },
      });
      applied += 1;
    }

    if (action.type === "REASSIGN_AGENT" && action.userId) {
      await prisma.contact.updateMany({
        where: { id: input.contactId, companyId: input.companyId },
        data: {
          assignedToUserId: action.userId,
          inboxAssignedAt: new Date(),
          inboxAssignmentSource: "SYSTEM",
          inboxAssignmentVersion: { increment: 1 },
        },
      });
      applied += 1;
    }
  }

  return applied;
}

async function runEscalationRules(input: {
  companyId: string;
  contactId: string;
  queueId: string | null;
  priority: string;
  triggerType: string;
  breachCount: number;
  dueAt: Date | null;
}) {
  const rules = await prisma.inboxEscalationRule.findMany({
    where: {
      companyId: input.companyId,
      active: true,
      triggerType: input.triggerType as never,
      OR: [{ queueId: input.queueId }, { queueId: null }],
      AND: [
        {
          OR: [{ priority: input.priority as never }, { priority: null }],
        },
        input.triggerType === "BREACH_COUNT"
          ? { triggerValue: { lte: input.breachCount } }
          : {},
      ],
    },
    orderBy: [{ triggerValue: "asc" }, { createdAt: "asc" }],
  });

  let escalated = 0;

  for (const rule of rules) {
    const alreadyApplied = await hasSlaEvent({
      companyId: input.companyId,
      contactId: input.contactId,
      type: "ESCALATED",
      dueAt: input.dueAt,
    });

    if (alreadyApplied) {
      continue;
    }

    const appliedActions = await applyEscalationActions({
      companyId: input.companyId,
      contactId: input.contactId,
      actions: parseActions(rule.actions),
    });

    await recordInboxSlaEvent({
      companyId: input.companyId,
      contactId: input.contactId,
      queueId: input.queueId,
      type: "ESCALATED",
      dueAt: input.dueAt,
      metadata: {
        ruleId: rule.id,
        ruleName: rule.name,
        triggerType: rule.triggerType,
        appliedActions,
      },
    });

    escalated += 1;
  }

  return escalated;
}

async function processDueSoon(input: {
  contact: {
    id: string;
    companyId: string;
    inboxQueueId: string | null;
    inboxPriority: string;
    name: string | null;
    phoneNumber: string;
    inboxFirstResponseDueAt: Date | null;
    inboxNextResponseDueAt: Date | null;
    inboxResolutionDueAt: Date | null;
  };
  now: Date;
}) {
  const policy = await getInboxSlaPolicy({
    companyId: input.contact.companyId,
    queueId: input.contact.inboxQueueId,
    priority: input.contact.inboxPriority,
  });
  const dueSoonAt = new Date(input.now.getTime() + policy.dueSoonMinutes * 60 * 1000);
  const timers = [
    ["FIRST_RESPONSE_BREACHED", input.contact.inboxFirstResponseDueAt],
    ["NEXT_RESPONSE_BREACHED", input.contact.inboxNextResponseDueAt],
    ["RESOLUTION_BREACHED", input.contact.inboxResolutionDueAt],
  ] as const;

  let created = 0;
  let escalated = 0;

  for (const [timerType, dueAt] of timers) {
    if (!dueAt || dueAt <= input.now || dueAt > dueSoonAt) {
      continue;
    }

    const exists = await hasSlaEvent({
      companyId: input.contact.companyId,
      contactId: input.contact.id,
      type: "DUE_SOON",
      dueAt,
    });

    if (exists) {
      continue;
    }

    await recordInboxSlaEvent({
      companyId: input.contact.companyId,
      contactId: input.contact.id,
      queueId: input.contact.inboxQueueId,
      policyId: policy.id,
      type: "DUE_SOON",
      dueAt,
      metadata: {
        timerType,
        dueSoonMinutes: policy.dueSoonMinutes,
      },
    });

    await notifySlaIssue({
      companyId: input.contact.companyId,
      contactId: input.contact.id,
      title: "Inbox SLA due soon",
      message: `${input.contact.name ?? input.contact.phoneNumber} needs attention before the SLA deadline.`,
      severity: "WARNING",
      idempotencyKey: `inbox-sla-due-soon:${input.contact.id}:${dueAt.toISOString()}`,
      metadata: {
        timerType,
        dueAt: dueAt.toISOString(),
      },
    });

    escalated += await runEscalationRules({
      companyId: input.contact.companyId,
      contactId: input.contact.id,
      queueId: input.contact.inboxQueueId,
      priority: input.contact.inboxPriority,
      triggerType: "DUE_SOON",
      breachCount: 0,
      dueAt,
    });
    created += 1;
  }

  return { created, escalated };
}

async function processBreach(input: {
  contact: {
    id: string;
    companyId: string;
    inboxQueueId: string | null;
    inboxPriority: string;
    name: string | null;
    phoneNumber: string;
    inboxFirstResponseDueAt: Date | null;
    inboxNextResponseDueAt: Date | null;
    inboxResolutionDueAt: Date | null;
    inboxSlaEscalationCount: number;
  };
  type: BreachType;
  dueAt: Date | null;
  now: Date;
}) {
  if (!input.dueAt || input.dueAt > input.now) {
    return { breached: 0, escalated: 0 };
  }

  const alreadyBreached = await hasSlaEvent({
    companyId: input.contact.companyId,
    contactId: input.contact.id,
    type: input.type,
    dueAt: input.dueAt,
  });

  if (alreadyBreached) {
    return { breached: 0, escalated: 0 };
  }

  const updated = await prisma.contact.updateMany({
    where: {
      id: input.contact.id,
      companyId: input.contact.companyId,
      inboxStatus: "OPEN",
    },
    data: {
      inboxSlaBreachedAt: input.now,
      inboxSlaEscalationCount: { increment: 1 },
    },
  });

  if (updated.count === 0) {
    return { breached: 0, escalated: 0 };
  }

  const policy = await getInboxSlaPolicy({
    companyId: input.contact.companyId,
    queueId: input.contact.inboxQueueId,
    priority: input.contact.inboxPriority,
  });

  await recordInboxSlaEvent({
    companyId: input.contact.companyId,
    contactId: input.contact.id,
    queueId: input.contact.inboxQueueId,
    policyId: policy.id,
    type: input.type,
    dueAt: input.dueAt,
    metadata: {
      breachedAt: input.now.toISOString(),
      priority: input.contact.inboxPriority,
    },
  });

  await createAuditLog({
    companyId: input.contact.companyId,
    actorUserId: null,
    action: `inbox.sla.${input.type.toLowerCase()}`,
    entityType: "Contact",
    entityId: input.contact.id,
    metadata: {
      contactId: input.contact.id,
      contactName: input.contact.name,
      phoneNumber: input.contact.phoneNumber,
      priority: input.contact.inboxPriority,
      dueAt: input.dueAt,
      breachedAt: input.now,
    },
  });

  await notifySlaIssue({
    companyId: input.contact.companyId,
    contactId: input.contact.id,
    title: "Inbox SLA breached",
    message: `${input.contact.name ?? input.contact.phoneNumber} breached ${input.type.replaceAll("_", " ").toLowerCase()}.`,
    severity: "ERROR",
    idempotencyKey: `inbox-sla-breached:${input.type}:${input.contact.id}:${input.dueAt.toISOString()}`,
    metadata: {
      timerType: input.type,
      dueAt: input.dueAt.toISOString(),
    },
  });

  const newBreachCount = input.contact.inboxSlaEscalationCount + 1;
  let escalated = await runEscalationRules({
    companyId: input.contact.companyId,
    contactId: input.contact.id,
    queueId: input.contact.inboxQueueId,
    priority: input.contact.inboxPriority,
    triggerType: input.type,
    breachCount: newBreachCount,
    dueAt: input.dueAt,
  });

  escalated += await runEscalationRules({
    companyId: input.contact.companyId,
    contactId: input.contact.id,
    queueId: input.contact.inboxQueueId,
    priority: input.contact.inboxPriority,
    triggerType: "BREACH_COUNT",
    breachCount: newBreachCount,
    dueAt: input.dueAt,
  });

  return { breached: 1, escalated };
}

async function resumeExpiredSnoozes(input: {
  companyId?: string;
  now: Date;
  limit: number;
}) {
  const contacts = await prisma.contact.findMany({
    where: {
      ...(input.companyId ? { companyId: input.companyId } : {}),
      snoozedUntil: { lte: input.now },
      inboxSlaPausedAt: { not: null },
    },
    select: {
      id: true,
      companyId: true,
      inboxQueueId: true,
      inboxSlaPausedAt: true,
      inboxSlaPausedSeconds: true,
    },
    take: input.limit,
  });

  for (const contact of contacts) {
    const pausedSeconds = contact.inboxSlaPausedAt
      ? Math.max(
          0,
          Math.floor((input.now.getTime() - contact.inboxSlaPausedAt.getTime()) / 1000),
        )
      : 0;

    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        snoozedUntil: null,
        snoozeReason: null,
        snoozedByUserId: null,
        snoozedAt: null,
        inboxSlaPausedAt: null,
        inboxSlaPausedSeconds: {
          increment: pausedSeconds,
        },
      },
    });

    await recordInboxSlaEvent({
      companyId: contact.companyId,
      contactId: contact.id,
      queueId: contact.inboxQueueId,
      type: "RESUMED",
      metadata: {
        source: "expired_snooze",
        pausedSeconds,
      },
    });
  }

  return contacts.length;
}

export async function processInboxSlaBreaches(
  input: ProcessInboxSlaBreachesInput = {},
) {
  const now = new Date();
  const limit = input.limit ?? 100;
  const resumedSnoozes = await resumeExpiredSnoozes({
    companyId: input.companyId,
    now,
    limit,
  });

  const contacts = await prisma.contact.findMany({
    where: {
      ...(input.companyId ? { companyId: input.companyId } : {}),
      inboxStatus: "OPEN",
      OR: [
        { inboxFirstResponseDueAt: { not: null } },
        { inboxNextResponseDueAt: { not: null } },
        { inboxResolutionDueAt: { not: null } },
        { inboxSlaDueAt: { not: null } },
      ],
    },
    select: {
      id: true,
      companyId: true,
      inboxQueueId: true,
      inboxPriority: true,
      name: true,
      phoneNumber: true,
      snoozedUntil: true,
      inboxFirstResponseDueAt: true,
      inboxNextResponseDueAt: true,
      inboxResolutionDueAt: true,
      inboxSlaEscalationCount: true,
    },
    orderBy: [{ inboxSlaDueAt: "asc" }, { updatedAt: "asc" }],
    take: limit,
  });

  let dueSoon = 0;
  let breached = 0;
  let escalated = 0;

  for (const contact of contacts) {
    const policy = await getInboxSlaPolicy({
      companyId: contact.companyId,
      queueId: contact.inboxQueueId,
      priority: contact.inboxPriority,
    });

    if (policy.pauseWhileSnoozed && isSnoozed(contact, now)) {
      continue;
    }

    const dueSoonResult = await processDueSoon({ contact, now });
    dueSoon += dueSoonResult.created;
    escalated += dueSoonResult.escalated;

    for (const [type, dueAt] of [
      ["FIRST_RESPONSE_BREACHED", contact.inboxFirstResponseDueAt],
      ["NEXT_RESPONSE_BREACHED", contact.inboxNextResponseDueAt],
      ["RESOLUTION_BREACHED", contact.inboxResolutionDueAt],
    ] as const) {
      const result = await processBreach({
        contact,
        type,
        dueAt,
        now,
      });
      breached += result.breached;
      escalated += result.escalated;
    }
  }

  return {
    scanned: contacts.length,
    dueSoon,
    breached,
    escalated,
    resumedSnoozes,
  };
}
