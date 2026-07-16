import {
  MessageDirection,
  MessageUsageLedgerStatus,
  PartnerClientSubscriptionStatus,
  PartnerUsageLimitAlertStatus,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { redactSensitiveData } from "@/server/utils/safe-logger";

const DAY_MS = 24 * 60 * 60 * 1000;
const ALERT_METRIC_DAILY_OUTBOUND_MESSAGES = "DAILY_OUTBOUND_MESSAGES";

export class PartnerUsageError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PartnerUsageError";
    this.status = status;
  }
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

function assertValidDate(date: Date, label: string) {
  if (Number.isNaN(date.getTime())) {
    throw new PartnerUsageError(`${label} is invalid.`);
  }
}

export function getUtcDayRange(value: Date | string | undefined | null) {
  const source = value ? new Date(value) : new Date();
  assertValidDate(source, "Usage date");

  const start = new Date(
    Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), source.getUTCDate()),
  );
  const end = new Date(start.getTime() + DAY_MS);

  return { start, end };
}

function daysBetween(start: Date, end: Date) {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY_MS));
}

function proratedDailyAmount({
  amountPaise,
  periodStart,
  periodEnd,
}: {
  amountPaise: number;
  periodStart: Date;
  periodEnd: Date;
}) {
  if (!Number.isInteger(amountPaise) || amountPaise < 0) return 0;

  return Math.round(amountPaise / daysBetween(periodStart, periodEnd));
}

export function calculateDailyPartnerUsageFinancials({
  currency = "INR",
  currentPeriodEnd,
  currentPeriodStart,
  retailAmountPaise,
  walletDebitPaise,
  wholesaleAmountPaise,
}: {
  wholesaleAmountPaise: number;
  retailAmountPaise: number;
  walletDebitPaise: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  currency?: string;
}) {
  const platformCostPaise = proratedDailyAmount({
    amountPaise: wholesaleAmountPaise,
    periodStart: currentPeriodStart,
    periodEnd: currentPeriodEnd,
  });
  const subscriptionRetailPaise = proratedDailyAmount({
    amountPaise: retailAmountPaise,
    periodStart: currentPeriodStart,
    periodEnd: currentPeriodEnd,
  });
  const retailChargePaise = subscriptionRetailPaise + Math.max(0, walletDebitPaise);
  const grossMarginPaise = retailChargePaise - platformCostPaise;
  const marginBasisPoints =
    retailChargePaise > 0
      ? Math.round((grossMarginPaise / retailChargePaise) * 10_000)
      : 0;

  return {
    currency,
    platformCostPaise,
    retailChargePaise,
    grossMarginPaise,
    marginBasisPoints,
  };
}

function dailyOutboundThreshold(monthlyMessageLimit: number | null | undefined) {
  if (!monthlyMessageLimit || monthlyMessageLimit <= 0) return null;

  return Math.max(1, Math.ceil(monthlyMessageLimit / 30));
}

async function reconcileUsageAlert({
  clientCompanyId,
  currentValue,
  partnerCompanyId,
  threshold,
  usageDailyId,
}: {
  partnerCompanyId: string;
  clientCompanyId: string;
  usageDailyId: string;
  currentValue: number;
  threshold: number | null;
}) {
  if (!threshold || currentValue < threshold) {
    await prisma.partnerUsageLimitAlert.updateMany({
      where: {
        usageDailyId,
        metric: ALERT_METRIC_DAILY_OUTBOUND_MESSAGES,
        status: PartnerUsageLimitAlertStatus.OPEN,
      },
      data: {
        status: PartnerUsageLimitAlertStatus.RESOLVED,
        resolvedAt: new Date(),
      },
    });

    return 0;
  }

  await prisma.partnerUsageLimitAlert.upsert({
    where: {
      usageDailyId_metric: {
        usageDailyId,
        metric: ALERT_METRIC_DAILY_OUTBOUND_MESSAGES,
      },
    },
    update: {
      currentValue,
      threshold,
      status: PartnerUsageLimitAlertStatus.OPEN,
      resolvedAt: null,
      message: `Daily outbound usage reached ${currentValue}/${threshold} messages.`,
      metadata: safeJson({ metric: ALERT_METRIC_DAILY_OUTBOUND_MESSAGES }),
    },
    create: {
      partnerCompanyId,
      clientCompanyId,
      usageDailyId,
      metric: ALERT_METRIC_DAILY_OUTBOUND_MESSAGES,
      currentValue,
      threshold,
      status: PartnerUsageLimitAlertStatus.OPEN,
      message: `Daily outbound usage reached ${currentValue}/${threshold} messages.`,
      metadata: safeJson({ metric: ALERT_METRIC_DAILY_OUTBOUND_MESSAGES }),
    },
  });

  return prisma.partnerUsageLimitAlert.count({
    where: {
      usageDailyId,
      status: PartnerUsageLimitAlertStatus.OPEN,
    },
  });
}

export async function aggregatePartnerUsageForDate({
  date,
  partnerCompanyId,
}: {
  date?: Date | string | null;
  partnerCompanyId?: string | null;
} = {}) {
  const { start, end } = getUtcDayRange(date);
  const subscriptions = await prisma.partnerClientSubscription.findMany({
    where: {
      status: PartnerClientSubscriptionStatus.ACTIVE,
      ...(partnerCompanyId ? { partnerCompanyId } : {}),
      startsAt: { lt: end },
      currentPeriodEnd: { gte: start },
    },
    include: {
      clientCompany: true,
      partnerCompany: true,
    },
    orderBy: [{ partnerCompany: { name: "asc" } }, { clientCompany: { name: "asc" } }],
  });

  let createdOrUpdated = 0;
  let openAlerts = 0;

  for (const subscription of subscriptions) {
    const companyId = subscription.clientCompanyId;
    const [
      outboundMessages,
      inboundMessages,
      campaignMessages,
      activeContacts,
      teamMembers,
      walletLedger,
    ] = await Promise.all([
      prisma.message.count({
        where: {
          companyId,
          direction: MessageDirection.OUTBOUND,
          createdAt: { gte: start, lt: end },
        },
      }),
      prisma.message.count({
        where: {
          companyId,
          direction: MessageDirection.INBOUND,
          createdAt: { gte: start, lt: end },
        },
      }),
      prisma.message.count({
        where: {
          companyId,
          direction: MessageDirection.OUTBOUND,
          campaignId: { not: null },
          createdAt: { gte: start, lt: end },
        },
      }),
      prisma.contact.count({
        where: {
          companyId,
          isBlocked: false,
        },
      }),
      prisma.companyUser.count({ where: { companyId } }),
      prisma.messageUsageLedger.aggregate({
        where: {
          companyId,
          status: MessageUsageLedgerStatus.CHARGED,
          createdAt: { gte: start, lt: end },
        },
        _sum: {
          amountPaise: true,
        },
      }),
    ]);

    const walletDebitPaise = walletLedger._sum.amountPaise ?? 0;
    const financials = calculateDailyPartnerUsageFinancials({
      wholesaleAmountPaise: subscription.wholesaleAmountPaise,
      retailAmountPaise: subscription.retailAmountPaise,
      walletDebitPaise,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      currency: subscription.currency,
    });

    const usage = await prisma.partnerClientUsageDaily.upsert({
      where: {
        partnerCompanyId_clientCompanyId_date: {
          partnerCompanyId: subscription.partnerCompanyId,
          clientCompanyId: subscription.clientCompanyId,
          date: start,
        },
      },
      update: {
        subscriptionId: subscription.id,
        outboundMessages,
        inboundMessages,
        campaignMessages,
        apiRequests: 0,
        activeContacts,
        teamMembers,
        walletDebitPaise,
        ...financials,
        metadata: safeJson({
          aggregationWindow: { start, end },
          source: "partner_usage_daily_aggregation",
          apiRequests: "not_tracked_yet",
        }),
      },
      create: {
        partnerCompanyId: subscription.partnerCompanyId,
        clientCompanyId: subscription.clientCompanyId,
        subscriptionId: subscription.id,
        date: start,
        outboundMessages,
        inboundMessages,
        campaignMessages,
        apiRequests: 0,
        activeContacts,
        teamMembers,
        walletDebitPaise,
        ...financials,
        metadata: safeJson({
          aggregationWindow: { start, end },
          source: "partner_usage_daily_aggregation",
          apiRequests: "not_tracked_yet",
        }),
      },
    });

    const limitAlertCount = await reconcileUsageAlert({
      partnerCompanyId: subscription.partnerCompanyId,
      clientCompanyId: subscription.clientCompanyId,
      usageDailyId: usage.id,
      currentValue: outboundMessages,
      threshold: dailyOutboundThreshold(subscription.clientCompany.monthlyMessageLimit),
    });

    await prisma.partnerClientUsageDaily.update({
      where: { id: usage.id },
      data: { limitAlertCount },
    });

    createdOrUpdated += 1;
    openAlerts += limitAlertCount;
  }

  return {
    date: start,
    createdOrUpdated,
    openAlerts,
    checkedSubscriptions: subscriptions.length,
  };
}

function defaultFromDate() {
  const { start } = getUtcDayRange(new Date(Date.now() - 13 * DAY_MS));
  return start;
}

function normalizeRange({ from, to }: { from?: string | null; to?: string | null }) {
  const fromDate = from ? getUtcDayRange(from).start : defaultFromDate();
  const toDate = to ? getUtcDayRange(to).start : getUtcDayRange(new Date()).start;

  if (fromDate > toDate) {
    throw new PartnerUsageError("From date must be before to date.");
  }

  return { fromDate, toDate };
}

export async function getPartnerUsageDashboard({
  from,
  partnerCompanyId,
  to,
}: {
  from?: string | null;
  to?: string | null;
  partnerCompanyId?: string | null;
} = {}) {
  const { fromDate, toDate } = normalizeRange({ from, to });
  const rows = await prisma.partnerClientUsageDaily.findMany({
    where: {
      date: { gte: fromDate, lte: toDate },
      ...(partnerCompanyId ? { partnerCompanyId } : {}),
    },
    include: {
      partnerCompany: { select: { id: true, name: true } },
      clientCompany: { select: { id: true, name: true, monthlyMessageLimit: true } },
    },
    orderBy: [{ date: "desc" }, { partnerCompany: { name: "asc" } }],
  });
  const alerts = await prisma.partnerUsageLimitAlert.findMany({
    where: {
      status: PartnerUsageLimitAlertStatus.OPEN,
      ...(partnerCompanyId ? { partnerCompanyId } : {}),
    },
    include: {
      partnerCompany: { select: { id: true, name: true } },
      clientCompany: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const partners = await prisma.company.findMany({
    where: { type: "PARTNER" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const totals = rows.reduce(
    (acc, row) => {
      acc.outboundMessages += row.outboundMessages;
      acc.inboundMessages += row.inboundMessages;
      acc.campaignMessages += row.campaignMessages;
      acc.activeContacts += row.activeContacts;
      acc.walletDebitPaise += row.walletDebitPaise;
      acc.retailChargePaise += row.retailChargePaise;
      acc.platformCostPaise += row.platformCostPaise;
      acc.grossMarginPaise += row.grossMarginPaise;
      acc.limitAlertCount += row.limitAlertCount;
      acc.clients.add(row.clientCompanyId);
      return acc;
    },
    {
      outboundMessages: 0,
      inboundMessages: 0,
      campaignMessages: 0,
      activeContacts: 0,
      walletDebitPaise: 0,
      retailChargePaise: 0,
      platformCostPaise: 0,
      grossMarginPaise: 0,
      limitAlertCount: 0,
      clients: new Set<string>(),
    },
  );

  const partnerSummary = Array.from(
    rows.reduce((map, row) => {
      const current = map.get(row.partnerCompanyId) ?? {
        partnerCompanyId: row.partnerCompanyId,
        partnerName: row.partnerCompany.name,
        outboundMessages: 0,
        retailChargePaise: 0,
        platformCostPaise: 0,
        grossMarginPaise: 0,
        clientIds: new Set<string>(),
      };
      current.outboundMessages += row.outboundMessages;
      current.retailChargePaise += row.retailChargePaise;
      current.platformCostPaise += row.platformCostPaise;
      current.grossMarginPaise += row.grossMarginPaise;
      current.clientIds.add(row.clientCompanyId);
      map.set(row.partnerCompanyId, current);
      return map;
    }, new Map<string, { partnerCompanyId: string; partnerName: string; outboundMessages: number; retailChargePaise: number; platformCostPaise: number; grossMarginPaise: number; clientIds: Set<string> }>()).values(),
  ).map((summary) => {
    const { clientIds, ...partnerTotals } = summary;

    return {
      ...partnerTotals,
      clientCount: clientIds.size,
      marginBasisPoints:
        partnerTotals.retailChargePaise > 0
          ? Math.round((partnerTotals.grossMarginPaise / partnerTotals.retailChargePaise) * 10_000)
          : 0,
    };
  });

  return {
    range: { from: fromDate, to: toDate },
    partners,
    totals: {
      outboundMessages: totals.outboundMessages,
      inboundMessages: totals.inboundMessages,
      campaignMessages: totals.campaignMessages,
      activeContacts: totals.activeContacts,
      walletDebitPaise: totals.walletDebitPaise,
      retailChargePaise: totals.retailChargePaise,
      platformCostPaise: totals.platformCostPaise,
      grossMarginPaise: totals.grossMarginPaise,
      marginBasisPoints:
        totals.retailChargePaise > 0
          ? Math.round((totals.grossMarginPaise / totals.retailChargePaise) * 10_000)
          : 0,
      limitAlertCount: totals.limitAlertCount,
      clientCount: totals.clients.size,
    },
    partnerSummary,
    rows,
    alerts,
  };
}

function csvEscape(value: unknown) {
  const text = value instanceof Date ? value.toISOString() : String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export async function exportPartnerUsageCsv(input: {
  from?: string | null;
  to?: string | null;
  partnerCompanyId?: string | null;
}) {
  const dashboard = await getPartnerUsageDashboard(input);
  const header = [
    "Date",
    "Partner",
    "Client",
    "Outbound Messages",
    "Inbound Messages",
    "Campaign Messages",
    "Active Contacts",
    "Team Members",
    "Wallet Debit Paise",
    "Retail Charge Paise",
    "Platform Cost Paise",
    "Gross Margin Paise",
    "Margin Bps",
    "Open Alerts",
  ];
  const lines = dashboard.rows.map((row) =>
    [
      row.date,
      row.partnerCompany.name,
      row.clientCompany.name,
      row.outboundMessages,
      row.inboundMessages,
      row.campaignMessages,
      row.activeContacts,
      row.teamMembers,
      row.walletDebitPaise,
      row.retailChargePaise,
      row.platformCostPaise,
      row.grossMarginPaise,
      row.marginBasisPoints,
      row.limitAlertCount,
    ]
      .map(csvEscape)
      .join(","),
  );

  return [header.map(csvEscape).join(","), ...lines].join("\n");
}
