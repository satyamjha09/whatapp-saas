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

function formatHealthTime(date: Date | null) {
  return date ? formatTimeAgo(date) : "No events yet";
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
    connectedWhatsAppAccounts,
    approvedTemplates,
    totalTemplates,
    outboundMessages,
    totalCampaigns,
    walletCredits,
    automationFlows,
    orders,
    lastWebhookEvent,
    failedMessages,
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
    prisma.whatsAppAccount.count({
      where: {
        companyId,
        status: "CONNECTED",
      },
    }),
    prisma.template.count({
      where: {
        companyId,
        status: "APPROVED",
      },
    }),
    prisma.template.count({
      where: {
        companyId,
      },
    }),
    prisma.message.count({
      where: {
        companyId,
        direction: "OUTBOUND",
      },
    }),
    prisma.campaign.count({
      where: {
        companyId,
      },
    }),
    prisma.walletTransaction.count({
      where: {
        companyId,
        status: "SUCCESS",
        type: "CREDIT",
      },
    }),
    prisma.automationFlow.count({
      where: {
        companyId,
      },
    }),
    prisma.order.count({
      where: {
        companyId,
      },
    }),
    prisma.webhookEvent.findFirst({
      where: {
        companyId,
        source: "whatsapp",
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        createdAt: true,
        status: true,
      },
    }),
    prisma.message.count({
      where: {
        companyId,
        status: "FAILED",
      },
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
  const walletBalancePaise = wallet?.balancePaise ?? 0;
  const embeddedSignupPublicReady =
    process.env.META_EMBEDDED_SIGNUP_PUBLIC_READY === "true";
  const webhookHealthy =
    connectedWhatsAppAccounts > 0 &&
    lastWebhookEvent?.status !== "FAILED" &&
    Boolean(lastWebhookEvent);
  const walletLowThresholdPaise = 50_000;
  const productionHealthItems = [
    {
      actionHref: "/dashboard/whatsapp",
      actionLabel: embeddedSignupPublicReady ? "Connect account" : "View setup",
      detail: embeddedSignupPublicReady
        ? "Official Facebook onboarding is ready for customer connections."
        : "Official Facebook onboarding is waiting for Meta App Review approval.",
      id: "meta-review",
      label: "Meta review",
      status: embeddedSignupPublicReady ? ("ready" as const) : ("attention" as const),
      value: embeddedSignupPublicReady ? "Approved" : "Pending",
    },
    {
      actionHref: "/dashboard/whatsapp",
      actionLabel: webhookHealthy ? "View events" : "Fix webhooks",
      detail:
        connectedWhatsAppAccounts === 0
          ? "Connect WhatsApp first so delivery and inbound events can arrive."
          : webhookHealthy
            ? `Last WhatsApp webhook received ${formatHealthTime(
                lastWebhookEvent?.createdAt ?? null,
              )}.`
            : "No successful WhatsApp webhook event has been seen yet.",
      id: "webhook",
      label: "Webhook",
      status: webhookHealthy ? ("ready" as const) : ("blocked" as const),
      value: webhookHealthy ? "Connected" : "Not confirmed",
    },
    {
      actionHref: "/dashboard/wallet",
      actionLabel: "Recharge",
      detail:
        walletBalancePaise <= 0
          ? "Wallet is empty, so paid sends can be blocked."
          : walletBalancePaise < walletLowThresholdPaise
            ? "Wallet is below the recommended production buffer."
            : "Wallet has enough balance for initial sending.",
      id: "wallet",
      label: "Wallet",
      status:
        walletBalancePaise <= 0
          ? ("blocked" as const)
          : walletBalancePaise < walletLowThresholdPaise
            ? ("attention" as const)
            : ("ready" as const),
      value: formatMoneyPaise(walletBalancePaise),
    },
    {
      actionHref: "/dashboard/templates",
      actionLabel: approvedTemplates > 0 ? "View templates" : "Create template",
      detail:
        approvedTemplates > 0
          ? `${approvedTemplates} approved template(s) are ready for sending.`
          : "At least one approved template is required for business-initiated sends.",
      id: "templates",
      label: "Templates",
      status: approvedTemplates > 0 ? ("ready" as const) : ("blocked" as const),
      value:
        approvedTemplates > 0 ? `${approvedTemplates} approved` : "None approved",
    },
    {
      actionHref: "/dashboard/reports/messages",
      actionLabel: "View queue",
      detail:
        queuedMessages > 0
          ? `${queuedMessages} queued message(s) are waiting for the worker.`
          : failedMessages > 0
            ? `${failedMessages} failed message(s) need review.`
            : "No queued messages right now. Add a worker heartbeat later for stronger monitoring.",
      id: "queue",
      label: "Worker / queue",
      status:
        queuedMessages > 25
          ? ("attention" as const)
          : failedMessages > 0
            ? ("attention" as const)
            : ("ready" as const),
      value: queuedMessages > 0 ? `${queuedMessages} queued` : "Clear",
    },
  ];
  const launchStepInputs = [
    {
      complete: true,
      description: "Your company workspace is ready.",
      blockedReason: null,
      href: "/dashboard/settings/company",
      id: "workspace",
      title: "Create workspace",
    },
    {
      complete: connectedWhatsAppAccounts > 0,
      description: "Connect a WhatsApp Business phone number.",
      blockedReason: "No connected WhatsApp phone number yet.",
      href: "/dashboard/whatsapp",
      id: "connect-whatsapp",
      title: "Connect WhatsApp",
    },
    {
      complete: approvedTemplates > 0,
      description:
        totalTemplates > 0
          ? `${approvedTemplates} approved of ${totalTemplates} template(s).`
          : "Create or sync an approved WhatsApp template.",
      blockedReason:
        totalTemplates > 0
          ? "Templates exist, but none are approved yet."
          : "No approved WhatsApp template is available.",
      href: "/dashboard/templates",
      id: "templates",
      title: "Sync or create templates",
    },
    {
      complete: contacts > 0,
      description: "Import or add contacts with consent.",
      blockedReason: "No contacts imported yet.",
      href: "/dashboard/contacts/import",
      id: "contacts",
      title: "Import contacts",
    },
    {
      complete: outboundMessages > 0,
      description: "Send one template message to confirm delivery.",
      blockedReason: "No outbound test message has been sent yet.",
      href: "/dashboard/messages/send",
      id: "test-message",
      title: "Send test message",
    },
    {
      complete: totalCampaigns > 0,
      description: "Launch your first official WhatsApp broadcast.",
      blockedReason: "No broadcast campaign has been created yet.",
      href: "/dashboard/broadcasts/new",
      id: "bulk-campaign",
      title: "Send broadcast campaign",
    },
    {
      complete: completedOutbound > 0,
      description: "Check message delivery and campaign reports.",
      blockedReason: "No completed message delivery status is available yet.",
      href: "/dashboard/reports/messages",
      id: "reports",
      title: "See delivery reports",
    },
    {
      complete: walletBalancePaise > 0 || walletCredits > 0,
      description: "Add credits so sending is not blocked.",
      blockedReason: "Wallet has no confirmed balance or recharge history.",
      href: "/dashboard/billing",
      id: "wallet",
      title: "Recharge wallet",
    },
    {
      complete: automationFlows > 0 || orders > 0,
      description: "Use automation, catalogs, flows, or order updates later.",
      blockedReason: "Advanced automation and orders can wait until setup is ready.",
      href: "/dashboard/automation",
      id: "advanced",
      optional: true,
      title: "Use automation or orders",
    },
  ];
  const firstIncompleteIndex = launchStepInputs.findIndex(
    (step) => !step.complete && !step.optional,
  );
  const launchPath = {
    completed: launchStepInputs.filter((step) => step.complete).length,
    currentActionLabel:
      firstIncompleteIndex === -1 ? "Explore advanced tools" : "Start setup",
    steps: launchStepInputs.map((step, index) => ({
      ...step,
      status: step.complete
        ? ("complete" as const)
        : index === firstIncompleteIndex ||
            (firstIncompleteIndex === -1 && step.optional)
          ? ("current" as const)
          : ("locked" as const),
    })),
    total: launchStepInputs.length,
  };

  return {
    activities,
    campaignPerformance,
    channelMix,
    launchPath,
    messageVolume,
    metrics,
    productionHealth: {
      blocked: productionHealthItems.filter((item) => item.status === "blocked")
        .length,
      items: productionHealthItems,
      ready: productionHealthItems.filter((item) => item.status === "ready").length,
      total: productionHealthItems.length,
    },
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
