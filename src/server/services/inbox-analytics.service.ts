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
