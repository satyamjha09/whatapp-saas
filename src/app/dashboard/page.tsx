import { redirect } from "next/navigation";
import {
  DashboardOverview,
  type DashboardMetric,
  type DashboardOverviewData,
} from "@/app/dashboard/dashboard-overview";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import type { MessageStatus } from "@/generated/prisma/enums";

function startOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatMoneyPaise(value: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value / 100);
}

function formatPeriodChange(current: number, previous: number) {
  if (previous === 0 && current === 0) {
    return "No change";
  }

  if (previous === 0) {
    return "New this week";
  }

  const change = ((current - previous) / previous) * 100;
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}% vs previous 7d`;
}

function formatTimeAgo(date: Date) {
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

  if (seconds < 60) {
    return "Just now";
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function getDashboardOverviewData(
  companyId: string,
): Promise<DashboardOverviewData> {
  const today = startOfDay(new Date());
  const currentStart = addDays(today, -6);
  const previousStart = addDays(currentStart, -7);
  const previousEnd = currentStart;

  const deliveredStatuses: MessageStatus[] = ["SENT", "DELIVERED", "READ"];
  const completedOutboundStatuses: MessageStatus[] = [
    "SENT",
    "DELIVERED",
    "READ",
    "FAILED",
  ];

  const [
    outboundSent,
    previousOutboundSent,
    completedOutbound,
    deliveredOutbound,
    contacts,
    currentContacts,
    previousContacts,
    openInbox,
    previousOpenInbox,
    wallet,
    currentWalletTransactions,
    previousWalletTransactions,
    queuedMessages,
    unreadInbound,
    messageStatuses,
    messagesThisWeek,
    campaigns,
    recentMessages,
    recentCampaigns,
    recentTransactions,
  ] = await Promise.all([
    prisma.message.count({
      where: {
        companyId,
        direction: "OUTBOUND",
        status: {
          in: deliveredStatuses,
        },
      },
    }),
    prisma.message.count({
      where: {
        companyId,
        createdAt: {
          gte: previousStart,
          lt: previousEnd,
        },
        direction: "OUTBOUND",
        status: {
          in: deliveredStatuses,
        },
      },
    }),
    prisma.message.count({
      where: {
        companyId,
        direction: "OUTBOUND",
        status: {
          in: completedOutboundStatuses,
        },
      },
    }),
    prisma.message.count({
      where: {
        companyId,
        direction: "OUTBOUND",
        status: {
          in: deliveredStatuses,
        },
      },
    }),
    prisma.contact.count({
      where: {
        companyId,
      },
    }),
    prisma.contact.count({
      where: {
        companyId,
        createdAt: {
          gte: currentStart,
        },
      },
    }),
    prisma.contact.count({
      where: {
        companyId,
        createdAt: {
          gte: previousStart,
          lt: previousEnd,
        },
      },
    }),
    prisma.contact.count({
      where: {
        companyId,
        inboxStatus: "OPEN",
      },
    }),
    prisma.contact.count({
      where: {
        companyId,
        createdAt: {
          gte: previousStart,
          lt: previousEnd,
        },
        inboxStatus: "OPEN",
      },
    }),
    prisma.wallet.findUnique({
      where: {
        companyId,
      },
    }),
    prisma.walletTransaction.findMany({
      where: {
        companyId,
        createdAt: {
          gte: currentStart,
        },
      },
      select: {
        amountPaise: true,
        type: true,
      },
    }),
    prisma.walletTransaction.findMany({
      where: {
        companyId,
        createdAt: {
          gte: previousStart,
          lt: previousEnd,
        },
      },
      select: {
        amountPaise: true,
        type: true,
      },
    }),
    prisma.message.count({
      where: {
        companyId,
        status: "QUEUED",
      },
    }),
    prisma.message.count({
      where: {
        companyId,
        direction: "INBOUND",
        inboxReadAt: null,
      },
    }),
    prisma.message.groupBy({
      by: ["status"],
      where: {
        companyId,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.message.findMany({
      where: {
        companyId,
        createdAt: {
          gte: currentStart,
        },
      },
      select: {
        createdAt: true,
        direction: true,
        status: true,
      },
    }),
    prisma.campaign.findMany({
      where: {
        companyId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        deliveredCount: true,
        name: true,
        readCount: true,
        totalContacts: true,
      },
      take: 5,
    }),
    prisma.message.findMany({
      where: {
        companyId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        createdAt: true,
        direction: true,
        status: true,
        toPhoneNumber: true,
      },
      take: 4,
    }),
    prisma.campaign.findMany({
      where: {
        companyId,
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        name: true,
        status: true,
        totalContacts: true,
        updatedAt: true,
      },
      take: 4,
    }),
    prisma.walletTransaction.findMany({
      where: {
        companyId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        amountPaise: true,
        createdAt: true,
        description: true,
        type: true,
      },
      take: 4,
    }),
  ]);

  const deliveryRate =
    completedOutbound === 0 ? 0 : (deliveredOutbound / completedOutbound) * 100;

  const transactionNet = (
    transactions: Array<{ amountPaise: number; type: string }>,
  ) =>
    transactions.reduce((total, transaction) => {
      if (transaction.type === "CREDIT" || transaction.type === "REFUND") {
        return total + transaction.amountPaise;
      }

      if (transaction.type === "DEBIT") {
        return total - transaction.amountPaise;
      }

      return total;
    }, 0);

  const metrics: DashboardMetric[] = [
    {
      label: "Messages sent",
      value: formatNumber(outboundSent),
      detail: formatPeriodChange(outboundSent, previousOutboundSent),
      tone: "indigo",
      icon: "send",
    },
    {
      label: "Delivery rate",
      value: formatPercent(deliveryRate),
      detail:
        completedOutbound === 0
          ? "No completed outbound messages"
          : `${formatNumber(deliveredOutbound)} of ${formatNumber(
              completedOutbound,
            )} completed`,
      tone: "emerald",
      icon: "check",
    },
    {
      label: "Contacts",
      value: formatNumber(contacts),
      detail: formatPeriodChange(currentContacts, previousContacts),
      tone: "violet",
      icon: "users",
    },
    {
      label: "Open inbox",
      value: formatNumber(openInbox),
      detail: formatPeriodChange(openInbox, previousOpenInbox),
      tone: "amber",
      icon: "message",
    },
    {
      label: "Wallet balance",
      value: formatMoneyPaise(wallet?.balancePaise ?? 0),
      detail: `${formatMoneyPaise(
        transactionNet(currentWalletTransactions),
      )} net this week`,
      tone: "cyan",
      icon: "wallet",
    },
  ];

  const messageVolume = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(currentStart, index);
    const nextDate = addDays(date, 1);
    const messagesForDay = messagesThisWeek.filter(
      (message) => message.createdAt >= date && message.createdAt < nextDate,
    );

    return {
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      delivered: messagesForDay.filter((message) =>
        deliveredStatuses.includes(message.status),
      ).length,
      inbound: messagesForDay.filter((message) => message.direction === "INBOUND")
        .length,
      sent: messagesForDay.filter((message) => message.direction === "OUTBOUND")
        .length,
    };
  });

  const statusColors: Record<string, string> = {
    DELIVERED: "#128C7E",
    FAILED: "#e11d48",
    QUEUED: "#F8C830",
    RETRY_PENDING: "#f59e0b",
    READ: "#128C7E",
    RECEIVED: "#075E54",
    SENDING: "#128C7E",
    SENT: "#22C55E",
  };

  const channelMix = messageStatuses.map((status) => ({
    color: statusColors[status.status] ?? "#71717a",
    name: status.status,
    value: status._count._all,
  }));

  const campaignPerformance = campaigns.map((campaign) => ({
    delivered:
      campaign.totalContacts === 0
        ? 0
        : Math.round((campaign.deliveredCount / campaign.totalContacts) * 100),
    name: campaign.name,
    read:
      campaign.totalContacts === 0
        ? 0
        : Math.round((campaign.readCount / campaign.totalContacts) * 100),
  }));

  const activities = [
    ...recentMessages.map((message) => ({
      detail:
        message.direction === "INBOUND"
          ? `Inbound message from +${message.toPhoneNumber}`
          : `Outbound message to +${message.toPhoneNumber}`,
      time: formatTimeAgo(message.createdAt),
      title: `Message ${message.status.toLowerCase()}`,
      type: "message" as const,
    })),
    ...recentCampaigns.map((campaign) => ({
      detail: `${formatNumber(campaign.totalContacts)} contacts`,
      time: formatTimeAgo(campaign.updatedAt),
      title: `${campaign.name} is ${campaign.status.toLowerCase()}`,
      type: "campaign" as const,
    })),
    ...recentTransactions.map((transaction) => ({
      detail:
        transaction.description ??
        `${transaction.type.toLowerCase()} ${formatMoneyPaise(
          transaction.amountPaise,
        )}`,
      time: formatTimeAgo(transaction.createdAt),
      title: `Wallet ${transaction.type.toLowerCase()}`,
      type: "wallet" as const,
    })),
  ].slice(0, 6);

  return {
    activities,
    campaignPerformance,
    channelMix,
    messageVolume,
    metrics,
    summary: {
      queuedMessages,
      previousWalletNetPaise: transactionNet(previousWalletTransactions),
      unreadInbound,
    },
  };
}

export default async function DashboardPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const overviewData = await getDashboardOverviewData(
    context.membership.companyId,
  );

  return (
    <DashboardOverview
      companyName={context.membership.company.name}
      data={overviewData}
      userName={context.user.name ?? context.user.email}
      userRole={context.membership.role}
    />
  );
}
