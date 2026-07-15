import { prisma } from "@/lib/prisma";
import { getWorkerHeartbeatHealth } from "@/server/services/worker-heartbeat.service";

const MONITORING_DUE_SOON_MS = 30 * 60 * 1000;
const MONITORING_HISTORY_DAYS = 30;

type MonitoringFilters = {
  queueId?: string | null;
};

function secondsBetween(start: Date | null | undefined, end: Date | null | undefined) {
  if (!start || !end) return null;
  const seconds = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
  return Number.isFinite(seconds) ? seconds : null;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function dueSoonWhere(now: Date, dueSoonUntil: Date) {
  return {
    OR: [
      { inboxSlaDueAt: { gte: now, lte: dueSoonUntil } },
      { inboxFirstResponseDueAt: { gte: now, lte: dueSoonUntil } },
      { inboxNextResponseDueAt: { gte: now, lte: dueSoonUntil } },
      { inboxResolutionDueAt: { gte: now, lte: dueSoonUntil } },
    ],
  };
}

function breachedWhere(now: Date) {
  return {
    OR: [
      { inboxSlaBreachedAt: { not: null } },
      { inboxSlaDueAt: { lt: now } },
      { inboxFirstResponseDueAt: { lt: now } },
      { inboxNextResponseDueAt: { lt: now } },
      { inboxResolutionDueAt: { lt: now } },
    ],
  };
}

export async function getInboxMonitoringDashboard(
  companyId: string,
  filters: MonitoringFilters = {},
) {
  const now = new Date();
  const dueSoonUntil = new Date(now.getTime() + MONITORING_DUE_SOON_MS);
  const historyStart = new Date(
    now.getTime() - MONITORING_HISTORY_DAYS * 24 * 60 * 60 * 1000,
  );
  const hasMessages = {
    messages: {
      some: {
        companyId,
      },
    },
  };
  const queueFilter = filters.queueId ? { inboxQueueId: filters.queueId } : {};

  const [
    agentProfiles,
    queues,
    backlogGroups,
    unassignedConversations,
    dueSoonConversations,
    breachedConversations,
    pendingApprovals,
    oldestWaitingConversation,
    firstResponseContacts,
    resolvedContacts,
    workerHealth,
  ] = await Promise.all([
    prisma.inboxAgentProfile.findMany({
      where: {
        companyId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            imageUrl: true,
          },
        },
      },
      orderBy: [
        {
          availabilityStatus: "asc",
        },
        {
          updatedAt: "desc",
        },
      ],
    }),

    prisma.inboxQueue.findMany({
      where: {
        companyId,
      },
      select: {
        id: true,
        name: true,
        color: true,
        status: true,
      },
      orderBy: {
        name: "asc",
      },
    }),

    prisma.contact.groupBy({
      by: ["inboxQueueId"],
      where: {
        companyId,
        inboxStatus: "OPEN",
        ...queueFilter,
        ...hasMessages,
      },
      _count: {
        _all: true,
      },
    }),

    prisma.contact.count({
      where: {
        companyId,
        inboxStatus: "OPEN",
        assignedToUserId: null,
        ...queueFilter,
        ...hasMessages,
      },
    }),

    prisma.contact.count({
      where: {
        companyId,
        inboxStatus: "OPEN",
        ...queueFilter,
        ...hasMessages,
        ...dueSoonWhere(now, dueSoonUntil),
      },
    }),

    prisma.contact.count({
      where: {
        companyId,
        inboxStatus: "OPEN",
        ...queueFilter,
        ...hasMessages,
        ...breachedWhere(now),
      },
    }),

    prisma.inboxReplyApproval.count({
      where: {
        companyId,
        status: "PENDING",
        ...(filters.queueId ? { queueId: filters.queueId } : {}),
      },
    }),

    prisma.contact.findFirst({
      where: {
        companyId,
        inboxStatus: "OPEN",
        inboxLastCustomerMessageAt: {
          not: null,
        },
        ...queueFilter,
        ...hasMessages,
      },
      select: {
        id: true,
        name: true,
        countryCode: true,
        phoneNumber: true,
        inboxLastCustomerMessageAt: true,
        inboxPriority: true,
        inboxQueue: {
          select: {
            id: true,
            name: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        inboxLastCustomerMessageAt: "asc",
      },
    }),

    prisma.contact.findMany({
      where: {
        companyId,
        inboxFirstRespondedAt: {
          gte: historyStart,
        },
        inboxLastCustomerMessageAt: {
          not: null,
        },
        ...queueFilter,
      },
      select: {
        inboxLastCustomerMessageAt: true,
        inboxFirstRespondedAt: true,
      },
      take: 500,
    }),

    prisma.contact.findMany({
      where: {
        companyId,
        inboxResolvedAt: {
          gte: historyStart,
        },
        inboxLastCustomerMessageAt: {
          not: null,
        },
        ...queueFilter,
      },
      select: {
        inboxLastCustomerMessageAt: true,
        inboxResolvedAt: true,
      },
      take: 500,
    }),

    getWorkerHeartbeatHealth(),
  ]);

  const queueById = new Map(queues.map((queue) => [queue.id, queue]));
  const backlogByQueue = backlogGroups.map((group) => {
    const queue = group.inboxQueueId ? queueById.get(group.inboxQueueId) : null;

    return {
      queueId: queue?.id ?? null,
      queueName: queue?.name ?? "No queue",
      color: queue?.color ?? null,
      openConversations: group._count._all,
    };
  });

  const totalBacklog = backlogByQueue.reduce(
    (sum, queue) => sum + queue.openConversations,
    0,
  );
  const firstResponseSamples = firstResponseContacts
    .map((contact) =>
      secondsBetween(contact.inboxLastCustomerMessageAt, contact.inboxFirstRespondedAt),
    )
    .filter((value): value is number => value !== null);
  const resolutionSamples = resolvedContacts
    .map((contact) =>
      secondsBetween(contact.inboxLastCustomerMessageAt, contact.inboxResolvedAt),
    )
    .filter((value): value is number => value !== null);

  const agentStatusCounts = agentProfiles.reduce(
    (acc, profile) => {
      acc[profile.availabilityStatus] += 1;
      return acc;
    },
    {
      AVAILABLE: 0,
      BUSY: 0,
      AWAY: 0,
      OFFLINE: 0,
    },
  );
  const relevantWorkers = workerHealth.expectedWorkers.filter((worker) =>
    ["message-worker", "webhook-worker", "inbox-sla-worker", "inbox-analytics-worker"].includes(
      worker.workerName,
    ),
  );

  return {
    generatedAt: now,
    agents: {
      total: agentProfiles.length,
      ...agentStatusCounts,
      profiles: agentProfiles.map((profile) => ({
        id: profile.id,
        userId: profile.userId,
        name: profile.user.name ?? profile.user.email,
        email: profile.user.email,
        imageUrl: profile.user.imageUrl,
        availabilityStatus: profile.availabilityStatus,
        acceptingNew: profile.acceptingNew,
        maxOpenConversations: profile.maxOpenConversations,
        lastSeenAt: profile.lastSeenAt,
      })),
    },
    queues: {
      totalBacklog,
      unassignedConversations,
      backlogByQueue,
    },
    sla: {
      dueSoonConversations,
      breachedConversations,
      averageFirstResponseSec: average(firstResponseSamples),
      averageResolutionSec: average(resolutionSamples),
      oldestWaitingConversation,
    },
    approvals: {
      pending: pendingApprovals,
    },
    collisions: {
      count: 0,
      conversations: [] as Array<never>,
    },
    workers: {
      healthy: relevantWorkers.filter((worker) => worker.isHealthy).length,
      unhealthy: relevantWorkers.filter((worker) => !worker.isHealthy).length,
      items: relevantWorkers,
    },
  };
}
