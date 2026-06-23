import { prisma } from "@/lib/prisma";

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function sinceHours(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

export async function getPlatformOverview() {
  const today = startOfToday();
  const since24h = sinceHours(24);

  const [
    companyCount,
    userCount,
    connectedWhatsAppAccounts,
    messages24h,
    failedMessages24h,
    inboundMessages24h,
    creditPurchasesToday,
    subscriptionPaymentsToday,
    failedWebhookEvents24h,
    activeApiKeys,
  ] = await Promise.all([
    prisma.company.count(),
    prisma.user.count(),
    prisma.whatsAppAccount.count({
      where: {
        status: "CONNECTED",
      },
    }),
    prisma.message.count({
      where: {
        createdAt: {
          gte: since24h,
        },
      },
    }),
    prisma.message.count({
      where: {
        status: "FAILED",
        createdAt: {
          gte: since24h,
        },
      },
    }),
    prisma.message.count({
      where: {
        direction: "INBOUND",
        createdAt: {
          gte: since24h,
        },
      },
    }),
    prisma.creditPurchase.count({
      where: {
        createdAt: {
          gte: today,
        },
      },
    }),
    prisma.subscriptionPayment.count({
      where: {
        createdAt: {
          gte: today,
        },
      },
    }),
    prisma.webhookEvent.count({
      where: {
        status: "FAILED",
        createdAt: {
          gte: since24h,
        },
      },
    }),
    prisma.apiKey.count({
      where: {
        status: "ACTIVE",
      },
    }),
  ]);

  return {
    companyCount,
    userCount,
    connectedWhatsAppAccounts,
    messages24h,
    failedMessages24h,
    inboundMessages24h,
    creditPurchasesToday,
    subscriptionPaymentsToday,
    failedWebhookEvents24h,
    activeApiKeys,
  };
}

export async function listPlatformCompanies({
  query,
  take = 50,
}: {
  query?: string;
  take?: number;
} = {}) {
  return prisma.company.findMany({
    where: query
      ? {
          OR: [
            {
              name: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              id: query,
            },
          ],
        }
      : undefined,
    orderBy: {
      createdAt: "desc",
    },
    take,
    include: {
      wallet: true,
      _count: {
        select: {
          users: true,
          contacts: true,
          messages: true,
          campaigns: true,
          apiKeys: true,
          developerWebhookEndpoints: true,
        },
      },
      whatsAppAccounts: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        select: {
          id: true,
          status: true,
          wabaId: true,
          businessName: true,
          updatedAt: true,
        },
      },
    },
  });
}

export async function getPlatformCompanyDetail({
  companyId,
}: {
  companyId: string;
}) {
  const since24h = sinceHours(24);

  const company = await prisma.company.findUnique({
    where: {
      id: companyId,
    },
    include: {
      wallet: true,
      users: {
        include: {
          user: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      whatsAppAccounts: {
        orderBy: {
          createdAt: "desc",
        },
        include: {
          phoneNumbers: true,
        },
      },
      _count: {
        select: {
          contacts: true,
          messages: true,
          campaigns: true,
          templates: true,
          apiKeys: true,
          developerWebhookEndpoints: true,
        },
      },
    },
  });

  if (!company) {
    return null;
  }

  const [
    messages24h,
    failedMessages24h,
    inboundMessages24h,
    latestMessages,
    latestPayments,
    latestWebhookEvents,
    latestAuditLogs,
  ] = await Promise.all([
    prisma.message.count({
      where: {
        companyId,
        createdAt: {
          gte: since24h,
        },
      },
    }),
    prisma.message.count({
      where: {
        companyId,
        status: "FAILED",
        createdAt: {
          gte: since24h,
        },
      },
    }),
    prisma.message.count({
      where: {
        companyId,
        direction: "INBOUND",
        createdAt: {
          gte: since24h,
        },
      },
    }),
    prisma.message.findMany({
      where: {
        companyId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
      select: {
        id: true,
        direction: true,
        status: true,
        toPhoneNumber: true,
        body: true,
        createdAt: true,
      },
    }),
    prisma.creditPurchase.findMany({
      where: {
        companyId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    }),
    prisma.webhookEvent.findMany({
      where: {
        companyId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
      select: {
        id: true,
        source: true,
        status: true,
        eventType: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.auditLog.findMany({
      where: {
        companyId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    }),
  ]);

  return {
    company,
    stats: {
      messages24h,
      failedMessages24h,
      inboundMessages24h,
    },
    latestMessages,
    latestPayments,
    latestWebhookEvents,
    latestAuditLogs,
  };
}
