import { prisma } from "@/lib/prisma";

const DUE_SOON_WINDOW_MS = 30 * 60 * 1000;

function buildCountMap<T extends string>(
  groups: Array<{
    [key: string]: T | number | { _all: number } | null;
    _count: {
      _all: number;
    };
  }>,
  key: string,
) {
  return groups.reduce<Record<T, number>>(
    (acc, group) => {
      const value = group[key];

      if (typeof value === "string") {
        acc[value as T] = group._count._all;
      }

      return acc;
    },
    {} as Record<T, number>,
  );
}

export async function getInboxAnalytics(companyId: string) {
  const now = new Date();
  const dueSoonUntil = new Date(now.getTime() + DUE_SOON_WINDOW_MS);
  const hasMessages = {
    messages: {
      some: {
        companyId,
      },
    },
  };

  const [
    totalConversations,
    openConversations,
    closedConversations,
    unassignedOpenConversations,
    unreadMessages,
    overdueConversations,
    dueSoonConversations,
    breachedConversations,
    priorityGroups,
    statusGroups,
    assignmentGroups,
    recentBreachedConversations,
    latestOpenConversations,
  ] = await Promise.all([
    prisma.contact.count({
      where: {
        companyId,
        ...hasMessages,
      },
    }),

    prisma.contact.count({
      where: {
        companyId,
        inboxStatus: "OPEN",
        ...hasMessages,
      },
    }),

    prisma.contact.count({
      where: {
        companyId,
        inboxStatus: "CLOSED",
        ...hasMessages,
      },
    }),

    prisma.contact.count({
      where: {
        companyId,
        inboxStatus: "OPEN",
        assignedToUserId: null,
        ...hasMessages,
      },
    }),

    prisma.message.count({
      where: {
        companyId,
        direction: "INBOUND",
        inboxReadAt: null,
      },
    }),

    prisma.contact.count({
      where: {
        companyId,
        inboxStatus: "OPEN",
        inboxSlaDueAt: {
          lt: now,
        },
        inboxSlaBreachedAt: null,
        ...hasMessages,
      },
    }),

    prisma.contact.count({
      where: {
        companyId,
        inboxStatus: "OPEN",
        inboxSlaDueAt: {
          gte: now,
          lte: dueSoonUntil,
        },
        inboxSlaBreachedAt: null,
        ...hasMessages,
      },
    }),

    prisma.contact.count({
      where: {
        companyId,
        inboxStatus: "OPEN",
        inboxSlaBreachedAt: {
          not: null,
        },
        ...hasMessages,
      },
    }),

    prisma.contact.groupBy({
      by: ["inboxPriority"],
      where: {
        companyId,
        ...hasMessages,
      },
      _count: {
        _all: true,
      },
    }),

    prisma.contact.groupBy({
      by: ["inboxStatus"],
      where: {
        companyId,
        ...hasMessages,
      },
      _count: {
        _all: true,
      },
    }),

    prisma.contact.groupBy({
      by: ["assignedToUserId"],
      where: {
        companyId,
        inboxStatus: "OPEN",
        ...hasMessages,
      },
      _count: {
        _all: true,
      },
    }),

    prisma.contact.findMany({
      where: {
        companyId,
        inboxStatus: "OPEN",
        inboxSlaBreachedAt: {
          not: null,
        },
        ...hasMessages,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        messages: {
          where: {
            companyId,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        inboxSlaBreachedAt: "desc",
      },
      take: 10,
    }),

    prisma.contact.findMany({
      where: {
        companyId,
        inboxStatus: "OPEN",
        ...hasMessages,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        messages: {
          where: {
            companyId,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: [
        {
          inboxSlaDueAt: "asc",
        },
        {
          updatedAt: "desc",
        },
      ],
      take: 10,
    }),
  ]);

  const assignedUserIds = assignmentGroups
    .map((group) => group.assignedToUserId)
    .filter((userId): userId is string => Boolean(userId));

  const users = assignedUserIds.length
    ? await prisma.user.findMany({
        where: {
          id: {
            in: assignedUserIds,
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          imageUrl: true,
        },
      })
    : [];

  const userById = new Map(users.map((user) => [user.id, user]));

  const agentWorkload = assignmentGroups
    .map((group) => {
      const user = group.assignedToUserId
        ? userById.get(group.assignedToUserId)
        : null;

      return {
        assignedToUserId: group.assignedToUserId,
        name: user?.name ?? "Unassigned",
        email: user?.email ?? null,
        imageUrl: user?.imageUrl ?? null,
        openConversationCount: group._count._all,
      };
    })
    .sort((a, b) => b.openConversationCount - a.openConversationCount);

  const priorityCounts = buildCountMap<
    "LOW" | "NORMAL" | "HIGH" | "URGENT"
  >(priorityGroups, "inboxPriority");

  const statusCounts = buildCountMap<"OPEN" | "CLOSED">(
    statusGroups,
    "inboxStatus",
  );

  return {
    summary: {
      totalConversations,
      openConversations,
      closedConversations,
      unassignedOpenConversations,
      unreadMessages,
      overdueConversations,
      dueSoonConversations,
      breachedConversations,
    },
    priorityCounts: {
      LOW: priorityCounts.LOW ?? 0,
      NORMAL: priorityCounts.NORMAL ?? 0,
      HIGH: priorityCounts.HIGH ?? 0,
      URGENT: priorityCounts.URGENT ?? 0,
    },
    statusCounts: {
      OPEN: statusCounts.OPEN ?? 0,
      CLOSED: statusCounts.CLOSED ?? 0,
    },
    agentWorkload,
    recentBreachedConversations,
    latestOpenConversations,
  };
}

const DEFAULT_ANALYTICS_DAYS = 14;
const NO_QUEUE_KEY = "__no_queue__";

type InboxAnalyticsFilters = {
  agentId?: string | null;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  queueId?: string | null;
};

type MutableDailyMetric = {
  companyId: string;
  userId: string;
  queueId: string | null;
  date: Date;
  assignedCount: number;
  replyCount: number;
  resolvedCount: number;
  reopenedCount: number;
  firstResponseValues: number[];
  resolutionValues: number[];
  slaMetCount: number;
  slaBreachedCount: number;
  csatScoreSum: number;
  csatResponseCount: number;
};

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function buildAnalyticsDateRange(filters: InboxAnalyticsFilters = {}) {
  const today = startOfUtcDay(new Date());
  const start = filters.dateFrom
    ? startOfUtcDay(filters.dateFrom)
    : addUtcDays(today, -(DEFAULT_ANALYTICS_DAYS - 1));
  const end = filters.dateTo
    ? addUtcDays(startOfUtcDay(filters.dateTo), 1)
    : addUtcDays(today, 1);

  return { start, end };
}

function metricKey({
  date,
  queueId,
  userId,
}: {
  date: Date;
  queueId: string | null;
  userId: string;
}) {
  return `${date.toISOString()}::${userId}::${queueId ?? NO_QUEUE_KEY}`;
}

function secondsBetween(start: Date | null | undefined, end: Date | null | undefined) {
  if (!start || !end) return null;
  const seconds = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
  return Number.isFinite(seconds) ? seconds : null;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1),
  );
  return sorted[index];
}

function createMetric({
  companyId,
  date,
  queueId,
  userId,
}: {
  companyId: string;
  date: Date;
  queueId: string | null;
  userId: string;
}): MutableDailyMetric {
  return {
    companyId,
    userId,
    queueId,
    date,
    assignedCount: 0,
    replyCount: 0,
    resolvedCount: 0,
    reopenedCount: 0,
    firstResponseValues: [],
    resolutionValues: [],
    slaMetCount: 0,
    slaBreachedCount: 0,
    csatScoreSum: 0,
    csatResponseCount: 0,
  };
}

function ensureMetric(
  metrics: Map<string, MutableDailyMetric>,
  input: {
    companyId: string;
    date: Date;
    queueId: string | null;
    userId: string | null | undefined;
  },
) {
  if (!input.userId) return null;

  const key = metricKey({
    date: input.date,
    queueId: input.queueId,
    userId: input.userId,
  });

  const existing = metrics.get(key);
  if (existing) return existing;

  const metric = createMetric({
    companyId: input.companyId,
    date: input.date,
    queueId: input.queueId,
    userId: input.userId,
  });

  metrics.set(key, metric);
  return metric;
}

function buildMetricCreateInput(metric: MutableDailyMetric) {
  return {
    companyId: metric.companyId,
    userId: metric.userId,
    queueId: metric.queueId,
    date: metric.date,
    assignedCount: metric.assignedCount,
    replyCount: metric.replyCount,
    resolvedCount: metric.resolvedCount,
    reopenedCount: metric.reopenedCount,
    averageFirstResponseSec: average(metric.firstResponseValues),
    p50FirstResponseSec: percentile(metric.firstResponseValues, 50),
    p90FirstResponseSec: percentile(metric.firstResponseValues, 90),
    averageResolutionSec: average(metric.resolutionValues),
    slaMetCount: metric.slaMetCount,
    slaBreachedCount: metric.slaBreachedCount,
    csatScoreSum: metric.csatScoreSum,
    csatResponseCount: metric.csatResponseCount,
  };
}

export async function aggregateInboxAgentMetricsDaily({
  companyId,
  date = new Date(),
}: {
  companyId: string;
  date?: Date;
}) {
  const day = startOfUtcDay(date);
  const nextDay = addUtcDays(day, 1);
  const metrics = new Map<string, MutableDailyMetric>();

  const [
    assignmentGroups,
    outboundReplies,
    firstRespondedContacts,
    resolvedContacts,
    reopenedEvents,
    slaMetEvents,
    slaBreachedEvents,
    csatResponses,
  ] = await Promise.all([
    prisma.inboxConversationAssignment.groupBy({
      by: ["assignedToUserId", "queueId"],
      where: {
        companyId,
        assignedAt: {
          gte: day,
          lt: nextDay,
        },
        assignedToUserId: {
          not: null,
        },
      },
      _count: {
        _all: true,
      },
    }),

    prisma.message.findMany({
      where: {
        companyId,
        direction: "OUTBOUND",
        sentByUserId: {
          not: null,
        },
        createdAt: {
          gte: day,
          lt: nextDay,
        },
      },
      select: {
        sentByUserId: true,
        contact: {
          select: {
            inboxQueueId: true,
          },
        },
      },
    }),

    prisma.contact.findMany({
      where: {
        companyId,
        assignedToUserId: {
          not: null,
        },
        inboxFirstRespondedAt: {
          gte: day,
          lt: nextDay,
        },
        inboxLastCustomerMessageAt: {
          not: null,
        },
      },
      select: {
        assignedToUserId: true,
        inboxQueueId: true,
        inboxLastCustomerMessageAt: true,
        inboxFirstRespondedAt: true,
      },
    }),

    prisma.contact.findMany({
      where: {
        companyId,
        assignedToUserId: {
          not: null,
        },
        inboxResolvedAt: {
          gte: day,
          lt: nextDay,
        },
      },
      select: {
        assignedToUserId: true,
        inboxQueueId: true,
        inboxLastCustomerMessageAt: true,
        inboxResolvedAt: true,
      },
    }),

    prisma.inboxSlaEvent.findMany({
      where: {
        companyId,
        type: "REOPENED",
        occurredAt: {
          gte: day,
          lt: nextDay,
        },
      },
      select: {
        actorUserId: true,
        queueId: true,
        contact: {
          select: {
            assignedToUserId: true,
            inboxQueueId: true,
          },
        },
      },
    }),

    prisma.inboxSlaEvent.findMany({
      where: {
        companyId,
        type: {
          in: ["RESPONDED", "RESOLVED"],
        },
        occurredAt: {
          gte: day,
          lt: nextDay,
        },
      },
      select: {
        actorUserId: true,
        queueId: true,
        contact: {
          select: {
            assignedToUserId: true,
            inboxQueueId: true,
          },
        },
      },
    }),

    prisma.inboxSlaEvent.findMany({
      where: {
        companyId,
        type: {
          in: [
            "FIRST_RESPONSE_BREACHED",
            "NEXT_RESPONSE_BREACHED",
            "RESOLUTION_BREACHED",
          ],
        },
        occurredAt: {
          gte: day,
          lt: nextDay,
        },
      },
      select: {
        actorUserId: true,
        queueId: true,
        contact: {
          select: {
            assignedToUserId: true,
            inboxQueueId: true,
          },
        },
      },
    }),

    prisma.inboxCsatSurvey.findMany({
      where: {
        companyId,
        respondedAt: {
          gte: day,
          lt: nextDay,
        },
        score: {
          not: null,
        },
      },
      select: {
        assignedToUserId: true,
        queueId: true,
        score: true,
        contact: {
          select: {
            assignedToUserId: true,
            inboxQueueId: true,
          },
        },
      },
    }),
  ]);

  for (const group of assignmentGroups) {
    const metric = ensureMetric(metrics, {
      companyId,
      date: day,
      queueId: group.queueId,
      userId: group.assignedToUserId,
    });

    if (metric) {
      metric.assignedCount += group._count._all;
    }
  }

  for (const message of outboundReplies) {
    const metric = ensureMetric(metrics, {
      companyId,
      date: day,
      queueId: message.contact.inboxQueueId,
      userId: message.sentByUserId,
    });

    if (metric) {
      metric.replyCount += 1;
    }
  }

  for (const contact of firstRespondedContacts) {
    const metric = ensureMetric(metrics, {
      companyId,
      date: day,
      queueId: contact.inboxQueueId,
      userId: contact.assignedToUserId,
    });
    const seconds = secondsBetween(
      contact.inboxLastCustomerMessageAt,
      contact.inboxFirstRespondedAt,
    );

    if (metric && seconds !== null) {
      metric.firstResponseValues.push(seconds);
    }
  }

  for (const contact of resolvedContacts) {
    const metric = ensureMetric(metrics, {
      companyId,
      date: day,
      queueId: contact.inboxQueueId,
      userId: contact.assignedToUserId,
    });
    const seconds = secondsBetween(contact.inboxLastCustomerMessageAt, contact.inboxResolvedAt);

    if (metric) {
      metric.resolvedCount += 1;

      if (seconds !== null) {
        metric.resolutionValues.push(seconds);
      }
    }
  }

  for (const event of reopenedEvents) {
    const metric = ensureMetric(metrics, {
      companyId,
      date: day,
      queueId: event.queueId ?? event.contact.inboxQueueId,
      userId: event.actorUserId ?? event.contact.assignedToUserId,
    });

    if (metric) {
      metric.reopenedCount += 1;
    }
  }

  for (const event of slaMetEvents) {
    const metric = ensureMetric(metrics, {
      companyId,
      date: day,
      queueId: event.queueId ?? event.contact.inboxQueueId,
      userId: event.actorUserId ?? event.contact.assignedToUserId,
    });

    if (metric) {
      metric.slaMetCount += 1;
    }
  }

  for (const event of slaBreachedEvents) {
    const metric = ensureMetric(metrics, {
      companyId,
      date: day,
      queueId: event.queueId ?? event.contact.inboxQueueId,
      userId: event.actorUserId ?? event.contact.assignedToUserId,
    });

    if (metric) {
      metric.slaBreachedCount += 1;
    }
  }

  for (const survey of csatResponses) {
    const metric = ensureMetric(metrics, {
      companyId,
      date: day,
      queueId: survey.queueId ?? survey.contact.inboxQueueId,
      userId: survey.assignedToUserId ?? survey.contact.assignedToUserId,
    });

    if (metric && survey.score !== null) {
      metric.csatScoreSum += survey.score;
      metric.csatResponseCount += 1;
    }
  }

  await prisma.$transaction([
    prisma.inboxAgentMetricDaily.deleteMany({
      where: {
        companyId,
        date: day,
      },
    }),
    prisma.inboxAgentMetricDaily.createMany({
      data: Array.from(metrics.values()).map(buildMetricCreateInput),
      skipDuplicates: true,
    }),
  ]);

  return {
    companyId,
    date: day,
    metricsWritten: metrics.size,
  };
}

export async function getInboxAnalyticsSummary(
  companyId: string,
  filters: InboxAnalyticsFilters = {},
) {
  const { start, end } = buildAnalyticsDateRange(filters);
  const where = {
    companyId,
    date: {
      gte: start,
      lt: end,
    },
    ...(filters.agentId ? { userId: filters.agentId } : {}),
    ...(filters.queueId ? { queueId: filters.queueId } : {}),
  };

  const [metrics, queues, agents] = await Promise.all([
    prisma.inboxAgentMetricDaily.findMany({
      where,
      orderBy: {
        date: "asc",
      },
    }),
    prisma.inboxQueue.findMany({
      where: {
        companyId,
      },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.user.findMany({
      where: {
        inboxAgentMetricDaily: {
          some: {
            companyId,
            date: {
              gte: start,
              lt: end,
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    }),
  ]);

  const totals = metrics.reduce(
    (acc, metric) => {
      acc.assigned += metric.assignedCount;
      acc.replies += metric.replyCount;
      acc.resolved += metric.resolvedCount;
      acc.reopened += metric.reopenedCount;
      acc.slaMet += metric.slaMetCount;
      acc.slaBreached += metric.slaBreachedCount;

      if (metric.averageFirstResponseSec !== null) {
        acc.firstResponseSamples.push(metric.averageFirstResponseSec);
      }

      if (metric.averageResolutionSec !== null) {
        acc.resolutionSamples.push(metric.averageResolutionSec);
      }

      if (metric.csatResponseCount > 0) {
        acc.csatScoreSum += metric.csatScoreSum;
        acc.csatResponseCount += metric.csatResponseCount;
      }

      return acc;
    },
    {
      assigned: 0,
      replies: 0,
      resolved: 0,
      reopened: 0,
      slaMet: 0,
      slaBreached: 0,
      firstResponseSamples: [] as number[],
      resolutionSamples: [] as number[],
      csatScoreSum: 0,
      csatResponseCount: 0,
    },
  );

  const dailyMap = new Map<
    string,
    {
      assigned: number;
      date: string;
      replies: number;
      resolved: number;
      slaBreached: number;
      slaMet: number;
    }
  >();

  for (const metric of metrics) {
    const dateKey = metric.date.toISOString().slice(0, 10);
    const row =
      dailyMap.get(dateKey) ??
      {
        date: dateKey,
        assigned: 0,
        replies: 0,
        resolved: 0,
        slaMet: 0,
        slaBreached: 0,
      };

    row.assigned += metric.assignedCount;
    row.replies += metric.replyCount;
    row.resolved += metric.resolvedCount;
    row.slaMet += metric.slaMetCount;
    row.slaBreached += metric.slaBreachedCount;
    dailyMap.set(dateKey, row);
  }

  const totalSla = totals.slaMet + totals.slaBreached;

  return {
    filters: {
      start,
      end,
      agentId: filters.agentId ?? null,
      queueId: filters.queueId ?? null,
    },
    totals: {
      assigned: totals.assigned,
      replies: totals.replies,
      resolved: totals.resolved,
      reopened: totals.reopened,
      averageFirstResponseSec: average(totals.firstResponseSamples),
      averageResolutionSec: average(totals.resolutionSamples),
      slaMet: totals.slaMet,
      slaBreached: totals.slaBreached,
      slaCompliancePct:
        totalSla === 0 ? null : Math.round((totals.slaMet / totalSla) * 1000) / 10,
      csat:
        totals.csatResponseCount === 0
          ? null
          : Math.round((totals.csatScoreSum / totals.csatResponseCount) * 10) / 10,
    },
    daily: Array.from(dailyMap.values()),
    filtersData: {
      queues,
      agents,
    },
  };
}

export async function getInboxAgentAnalytics(
  companyId: string,
  filters: InboxAnalyticsFilters = {},
) {
  const { start, end } = buildAnalyticsDateRange(filters);
  const metrics = await prisma.inboxAgentMetricDaily.findMany({
    where: {
      companyId,
      date: {
        gte: start,
        lt: end,
      },
      ...(filters.agentId ? { userId: filters.agentId } : {}),
      ...(filters.queueId ? { queueId: filters.queueId } : {}),
    },
    include: {
      queue: {
        select: {
          id: true,
          name: true,
        },
      },
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
        date: "desc",
      },
      {
        replyCount: "desc",
      },
    ],
  });

  const agentMap = new Map<
    string,
    {
      user: (typeof metrics)[number]["user"];
      assigned: number;
      replies: number;
      resolved: number;
      reopened: number;
      slaMet: number;
      slaBreached: number;
      firstResponseSamples: number[];
      resolutionSamples: number[];
      csatScoreSum: number;
      csatResponseCount: number;
      queues: Set<string>;
    }
  >();

  for (const metric of metrics) {
    const row =
      agentMap.get(metric.userId) ??
      {
        user: metric.user,
        assigned: 0,
        replies: 0,
        resolved: 0,
        reopened: 0,
        slaMet: 0,
        slaBreached: 0,
        firstResponseSamples: [],
        resolutionSamples: [],
        csatScoreSum: 0,
        csatResponseCount: 0,
        queues: new Set<string>(),
      };

    row.assigned += metric.assignedCount;
    row.replies += metric.replyCount;
    row.resolved += metric.resolvedCount;
    row.reopened += metric.reopenedCount;
    row.slaMet += metric.slaMetCount;
    row.slaBreached += metric.slaBreachedCount;
    row.csatScoreSum += metric.csatScoreSum;
    row.csatResponseCount += metric.csatResponseCount;

    if (metric.averageFirstResponseSec !== null) {
      row.firstResponseSamples.push(metric.averageFirstResponseSec);
    }

    if (metric.averageResolutionSec !== null) {
      row.resolutionSamples.push(metric.averageResolutionSec);
    }

    if (metric.queue?.name) {
      row.queues.add(metric.queue.name);
    }

    agentMap.set(metric.userId, row);
  }

  return Array.from(agentMap.values())
    .map((row) => {
      const totalSla = row.slaMet + row.slaBreached;
      return {
        user: row.user,
        assigned: row.assigned,
        replies: row.replies,
        resolved: row.resolved,
        reopened: row.reopened,
        averageFirstResponseSec: average(row.firstResponseSamples),
        averageResolutionSec: average(row.resolutionSamples),
        slaMet: row.slaMet,
        slaBreached: row.slaBreached,
        slaCompliancePct:
          totalSla === 0 ? null : Math.round((row.slaMet / totalSla) * 1000) / 10,
        csat:
          row.csatResponseCount === 0
            ? null
            : Math.round((row.csatScoreSum / row.csatResponseCount) * 10) / 10,
        csatResponseCount: row.csatResponseCount,
        queues: Array.from(row.queues),
      };
    })
    .sort((a, b) => b.replies - a.replies);
}

export async function getInboxQueueAnalytics(
  companyId: string,
  filters: InboxAnalyticsFilters = {},
) {
  const { start, end } = buildAnalyticsDateRange(filters);
  const metrics = await prisma.inboxAgentMetricDaily.findMany({
    where: {
      companyId,
      date: {
        gte: start,
        lt: end,
      },
      ...(filters.agentId ? { userId: filters.agentId } : {}),
      ...(filters.queueId ? { queueId: filters.queueId } : {}),
    },
    include: {
      queue: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
    },
  });

  const queueMap = new Map<
    string,
    {
      queue: { color: string | null; id: string | null; name: string };
      assigned: number;
      replies: number;
      resolved: number;
      slaBreached: number;
      slaMet: number;
      csatScoreSum: number;
      csatResponseCount: number;
    }
  >();

  for (const metric of metrics) {
    const key = metric.queueId ?? NO_QUEUE_KEY;
    const row =
      queueMap.get(key) ??
      {
        queue: {
          id: metric.queue?.id ?? null,
          name: metric.queue?.name ?? "No queue",
          color: metric.queue?.color ?? null,
        },
        assigned: 0,
        replies: 0,
        resolved: 0,
        slaMet: 0,
        slaBreached: 0,
        csatScoreSum: 0,
        csatResponseCount: 0,
      };

    row.assigned += metric.assignedCount;
    row.replies += metric.replyCount;
    row.resolved += metric.resolvedCount;
    row.slaMet += metric.slaMetCount;
    row.slaBreached += metric.slaBreachedCount;
    row.csatScoreSum += metric.csatScoreSum;
    row.csatResponseCount += metric.csatResponseCount;
    queueMap.set(key, row);
  }

  return Array.from(queueMap.values())
    .map((row) => ({
      ...row,
      csat:
        row.csatResponseCount === 0
          ? null
          : Math.round((row.csatScoreSum / row.csatResponseCount) * 10) / 10,
    }))
    .sort((a, b) => b.assigned - a.assigned);
}

export async function getInboxSlaAnalytics(
  companyId: string,
  filters: InboxAnalyticsFilters = {},
) {
  const { start, end } = buildAnalyticsDateRange(filters);
  const summary = await getInboxAnalyticsSummary(companyId, filters);
  const events = await prisma.inboxSlaEvent.groupBy({
    by: ["type"],
    where: {
      companyId,
      occurredAt: {
        gte: start,
        lt: end,
      },
      ...(filters.queueId ? { queueId: filters.queueId } : {}),
      ...(filters.agentId ? { actorUserId: filters.agentId } : {}),
    },
    _count: {
      _all: true,
    },
  });

  return {
    ...summary.totals,
    eventCounts: events.map((event) => ({
      type: event.type,
      count: event._count._all,
    })),
  };
}
