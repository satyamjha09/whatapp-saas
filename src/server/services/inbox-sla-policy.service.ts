import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { addBusinessMinutes } from "@/server/services/inbox-business-hours.service";

type InboxPriorityValue = "LOW" | "NORMAL" | "HIGH" | "URGENT";
type InboxSlaEventTypeValue =
  | "TIMER_SET"
  | "DUE_SOON"
  | "FIRST_RESPONSE_BREACHED"
  | "NEXT_RESPONSE_BREACHED"
  | "RESOLUTION_BREACHED"
  | "RESPONDED"
  | "RESOLVED"
  | "SNOOZED"
  | "PAUSED"
  | "RESUMED"
  | "ESCALATED"
  | "REOPENED";

const DEFAULT_POLICY_BY_PRIORITY: Record<
  InboxPriorityValue,
  {
    firstResponseMinutes: number;
    nextResponseMinutes: number;
    resolutionMinutes: number;
    dueSoonMinutes: number;
  }
> = {
  URGENT: {
    firstResponseMinutes: 15,
    nextResponseMinutes: 30,
    resolutionMinutes: 240,
    dueSoonMinutes: 10,
  },
  HIGH: {
    firstResponseMinutes: 60,
    nextResponseMinutes: 120,
    resolutionMinutes: 480,
    dueSoonMinutes: 20,
  },
  NORMAL: {
    firstResponseMinutes: 240,
    nextResponseMinutes: 240,
    resolutionMinutes: 1440,
    dueSoonMinutes: 30,
  },
  LOW: {
    firstResponseMinutes: 1440,
    nextResponseMinutes: 1440,
    resolutionMinutes: 4320,
    dueSoonMinutes: 120,
  },
};

function normalizePriority(priority?: string | null): InboxPriorityValue {
  if (priority === "LOW" || priority === "HIGH" || priority === "URGENT") {
    return priority;
  }

  return "NORMAL";
}

export async function getInboxSlaPolicy(input: {
  companyId: string;
  queueId?: string | null;
  priority?: string | null;
}) {
  const priority = normalizePriority(input.priority);

  const policy = await prisma.inboxSlaPolicy.findFirst({
    where: {
      companyId: input.companyId,
      priority,
      active: true,
      OR: [
        ...(input.queueId ? [{ queueId: input.queueId }] : []),
        { queueId: null },
      ],
    },
    orderBy: [{ queueId: "desc" }, { createdAt: "asc" }],
  });

  if (policy) {
    return policy;
  }

  const defaults = DEFAULT_POLICY_BY_PRIORITY[priority];

  return prisma.inboxSlaPolicy.create({
    data: {
      companyId: input.companyId,
      queueId: input.queueId ?? null,
      priority,
      ...defaults,
      pauseWhileSnoozed: true,
    },
  });
}

export async function listInboxSlaPolicies(companyId: string) {
  return prisma.inboxSlaPolicy.findMany({
    where: { companyId },
    include: {
      queue: { select: { id: true, name: true } },
    },
    orderBy: [{ queueId: "asc" }, { priority: "asc" }],
  });
}

export async function calculateInboxSlaTimers(input: {
  companyId: string;
  queueId?: string | null;
  priority?: string | null;
  from?: Date;
  needsFirstResponse: boolean;
  needsResolution?: boolean;
}) {
  const from = input.from ?? new Date();
  const policy = await getInboxSlaPolicy(input);
  const responseMinutes = input.needsFirstResponse
    ? policy.firstResponseMinutes
    : policy.nextResponseMinutes;

  const [responseDueAt, resolutionDueAt] = await Promise.all([
    addBusinessMinutes({
      companyId: input.companyId,
      queueId: input.queueId,
      from,
      minutes: responseMinutes,
    }),
    input.needsResolution
      ? addBusinessMinutes({
          companyId: input.companyId,
          queueId: input.queueId,
          from,
          minutes: policy.resolutionMinutes,
        })
      : Promise.resolve(null),
  ]);

  return {
    policy,
    firstResponseDueAt: input.needsFirstResponse ? responseDueAt : null,
    nextResponseDueAt: input.needsFirstResponse ? null : responseDueAt,
    resolutionDueAt,
    legacyDueAt: responseDueAt,
  };
}

export async function recordInboxSlaEvent(input: {
  companyId: string;
  contactId: string;
  queueId?: string | null;
  policyId?: string | null;
  actorUserId?: string | null;
  type: InboxSlaEventTypeValue;
  dueAt?: Date | null;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.inboxSlaEvent.create({
    data: {
      companyId: input.companyId,
      contactId: input.contactId,
      queueId: input.queueId ?? null,
      policyId: input.policyId ?? null,
      actorUserId: input.actorUserId ?? null,
      type: input.type,
      dueAt: input.dueAt ?? null,
      metadata: input.metadata,
    },
  });
}
