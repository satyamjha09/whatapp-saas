import type { MessageStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

type DailyPoint = {
  date: string;
  delivered: number;
  failed: number;
  read: number;
  replied: number;
  sent: number;
};

type PerformanceBucket = {
  delivered: number;
  failed: number;
  name: string;
  read: number;
  replied: number;
  sent: number;
};

type HourlyPoint = {
  failed: number;
  hour: number;
  label: string;
  read: number;
  replied: number;
  sent: number;
};

const DAY_MS = 86_400_000;
const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const timeWindows = [
  { end: 5, name: "Late night", start: 0 },
  { end: 9, name: "Morning", start: 6 },
  { end: 13, name: "Midday", start: 10 },
  { end: 17, name: "Afternoon", start: 14 },
  { end: 21, name: "Evening", start: 18 },
  { end: 23, name: "Night", start: 22 },
];

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function dateSeries(days: number) {
  const today = startOfDay(new Date());
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today.getTime() - (days - 1 - index) * DAY_MS);
    return dayKey(date);
  });
}

function safeRate(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 10_000) / 100;
}

function trendPercent(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 10_000) / 100;
}

function paisePerUnit(amountPaise: number, unitCount: number) {
  if (unitCount <= 0) return 0;
  return Math.round(amountPaise / unitCount);
}

function roiPercent(revenuePaise: number, costPaise: number) {
  if (costPaise <= 0) return revenuePaise > 0 ? 100 : 0;
  return Math.round(((revenuePaise - costPaise) / costPaise) * 10_000) / 100;
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreGrade(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Healthy";
  if (score >= 50) return "Needs attention";
  return "At risk";
}

function sumByStatus(
  events: Array<{ createdAt: Date; status: MessageStatus }>,
  from: Date,
  status: MessageStatus,
) {
  return events.filter(
    (event) => event.status === status && event.createdAt >= from,
  ).length;
}

function emptyDailyPoint(date: string): DailyPoint {
  return {
    date,
    delivered: 0,
    failed: 0,
    read: 0,
    replied: 0,
    sent: 0,
  };
}

function cleanFailureLabel({
  code,
  fallback,
}: {
  code?: string | null;
  fallback?: string | null;
}) {
  const label = code || fallback || "Unknown failure";
  return label.length > 80 ? `${label.slice(0, 77)}...` : label;
}

function experimentConfidence(totalSent: number, variantCount: number) {
  if (variantCount >= 3 && totalSent >= 2_000) return "High";
  if (totalSent >= 500) return "Medium";
  return "Directional";
}

function decisionVerdict({
  deliveryRate,
  failureRate,
  readRate,
  replyRate,
  roi,
  sent,
}: {
  deliveryRate: number;
  failureRate: number;
  readRate: number;
  replyRate: number;
  roi: number;
  sent: number;
}) {
  if (sent <= 0) return "Collect data";
  if (failureRate >= 12 || deliveryRate < 70) return "Fix delivery";
  if (readRate < 25 || replyRate < 3) return "Optimize creative";
  if (roi >= 0 && readRate >= 40 && replyRate >= 5) return "Scale carefully";
  return "Keep testing";
}

function decisionConfidence({
  campaignCount,
  conversionCount,
  sent,
}: {
  campaignCount: number;
  conversionCount: number;
  sent: number;
}) {
  if (sent >= 5_000 && campaignCount >= 5 && conversionCount > 0) {
    return "High";
  }
  if (sent >= 1_000 && campaignCount >= 2) return "Medium";
  return "Directional";
}

function emptyPerformanceBucket(name: string): PerformanceBucket {
  return {
    delivered: 0,
    failed: 0,
    name,
    read: 0,
    replied: 0,
    sent: 0,
  };
}

function toPerformanceRows(buckets: Map<string, PerformanceBucket>) {
  return Array.from(buckets.values())
    .map((bucket) => ({
      ...bucket,
      deliveryRate: safeRate(bucket.delivered, bucket.sent),
      failureRate: safeRate(bucket.failed, bucket.sent || bucket.delivered),
      readRate: safeRate(bucket.read, bucket.delivered || bucket.sent),
      replyRate: safeRate(bucket.replied, bucket.delivered || bucket.sent),
    }))
    .sort((a, b) => b.sent - a.sent)
    .slice(0, 8);
}

function incrementPerformanceBucket(
  buckets: Map<string, PerformanceBucket>,
  name: string,
  values: Omit<PerformanceBucket, "name">,
) {
  const bucket = buckets.get(name) ?? emptyPerformanceBucket(name);
  bucket.sent += values.sent;
  bucket.delivered += values.delivered;
  bucket.read += values.read;
  bucket.replied += values.replied;
  bucket.failed += values.failed;
  buckets.set(name, bucket);
}

function emptyHourlyPoint(hour: number): HourlyPoint {
  return {
    failed: 0,
    hour,
    label: `${String(hour).padStart(2, "0")}:00`,
    read: 0,
    replied: 0,
    sent: 0,
  };
}

function timeWindowName(hour: number) {
  return (
    timeWindows.find((window) => hour >= window.start && hour <= window.end)
      ?.name ?? "Unknown"
  );
}

function scoreReasons({
  deliveryRate,
  failureRate,
  readRate,
  replyRate,
}: {
  deliveryRate: number;
  failureRate: number;
  readRate: number;
  replyRate: number;
}) {
  const reasons: string[] = [];

  if (deliveryRate >= 90) reasons.push("Strong delivery rate");
  if (readRate >= 45) reasons.push("Healthy read engagement");
  if (replyRate >= 8) reasons.push("Good reply momentum");
  if (failureRate >= 8) reasons.push("Failure rate needs investigation");
  if (deliveryRate < 70) reasons.push("Delivery quality is weak");
  if (readRate < 20) reasons.push("Creative or audience relevance may be low");
  if (replyRate < 2) reasons.push("Replies are low for the current audience");

  return reasons.slice(0, 4);
}

export async function getAdvancedCampaignAnalyticsDashboard({
  companyId,
  days = 30,
}: {
  companyId: string;
  days?: number;
}) {
  const safeDays = Math.min(Math.max(days, 7), 90);
  const currentFrom = new Date(Date.now() - safeDays * DAY_MS);
  const previousFrom = new Date(Date.now() - safeDays * 2 * DAY_MS);

  const [
    campaigns,
    events,
    replies,
    conversions,
    failureInsights,
    failedMessages,
    reportExports,
    segments,
  ] = await Promise.all([
    prisma.campaign.findMany({
      where: { companyId },
      include: {
        analyticsSnapshot: true,
        template: {
          select: {
            category: true,
            language: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.messageEvent.findMany({
      where: {
        companyId,
        createdAt: { gte: previousFrom },
        message: {
          campaignId: { not: null },
          direction: "OUTBOUND",
        },
        status: { in: ["SENT", "DELIVERED", "READ", "FAILED"] },
      },
      select: {
        createdAt: true,
        status: true,
      },
      take: 100_000,
    }),
    prisma.campaignReplyAttribution.findMany({
      where: {
        companyId,
        repliedAt: { gte: previousFrom },
      },
      select: {
        campaignId: true,
        repliedAt: true,
        intent: true,
      },
      take: 50_000,
    }),
    prisma.campaignConversionEvent.findMany({
      where: {
        companyId,
        occurredAt: { gte: previousFrom },
      },
      select: {
        campaignId: true,
        occurredAt: true,
        type: true,
        valuePaise: true,
      },
      take: 50_000,
    }),
    prisma.campaignFailureInsight.findMany({
      where: { companyId },
      orderBy: [{ failedMessageCount: "desc" }, { lastSeenAt: "desc" }],
      select: {
        category: true,
        errorCode: true,
        failedMessageCount: true,
        retryableMessageCount: true,
        retrySafety: true,
        sampleErrorMessage: true,
        severity: true,
      },
      take: 8,
    }),
    prisma.message.findMany({
      where: {
        campaignId: { not: null },
        companyId,
        status: "FAILED",
        updatedAt: { gte: previousFrom },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        errorCode: true,
        errorMessage: true,
      },
      take: 5_000,
    }),
    prisma.campaignReportExport.findMany({
      where: {
        companyId,
        createdAt: { gte: currentFrom },
      },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        filename: true,
        format: true,
        rowCount: true,
        sizeBytes: true,
      },
      take: 8,
    }),
    prisma.contactSegment.findMany({
      where: { companyId },
      orderBy: [{ lastPreviewAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        lastPreviewAt: true,
        lastPreviewCount: true,
        name: true,
        status: true,
      },
      take: 8,
    }),
  ]);

  const totals = campaigns.reduce(
    (next, campaign) => {
      const snapshot = campaign.analyticsSnapshot;
      const totalContacts = snapshot?.totalContacts ?? campaign.totalContacts;
      const sent = snapshot?.sentCount ?? campaign.sentCount;
      const delivered = snapshot?.deliveredCount ?? campaign.deliveredCount;
      const read = snapshot?.readCount ?? campaign.readCount;
      const failed = snapshot?.failedCount ?? campaign.failedCount;
      const replied = snapshot?.repliedCount ?? 0;
      const costPaise = snapshot?.totalCostPaise ?? 0;

      next.totalContacts += totalContacts;
      next.sent += sent;
      next.delivered += delivered;
      next.read += read;
      next.failed += failed;
      next.replied += replied;
      next.costPaise += costPaise;
      return next;
    },
    {
      costPaise: 0,
      delivered: 0,
      failed: 0,
      read: 0,
      replied: 0,
      sent: 0,
      totalContacts: 0,
    },
  );

  const currentSent = sumByStatus(events, currentFrom, "SENT");
  const previousSent =
    sumByStatus(events, previousFrom, "SENT") - currentSent;
  const currentDelivered = sumByStatus(events, currentFrom, "DELIVERED");
  const previousDelivered =
    sumByStatus(events, previousFrom, "DELIVERED") - currentDelivered;
  const currentRead = sumByStatus(events, currentFrom, "READ");
  const previousRead = sumByStatus(events, previousFrom, "READ") - currentRead;
  const currentReplies = replies.filter(
    (reply) => reply.repliedAt >= currentFrom,
  ).length;
  const previousReplies = replies.length - currentReplies;
  const currentConversions = conversions.filter(
    (conversion) => conversion.occurredAt >= currentFrom,
  );
  const previousConversions = conversions.filter(
    (conversion) => conversion.occurredAt < currentFrom,
  );
  const currentRevenuePaise = currentConversions.reduce(
    (sum, conversion) => sum + (conversion.valuePaise ?? 0),
    0,
  );
  const previousRevenuePaise = previousConversions.reduce(
    (sum, conversion) => sum + (conversion.valuePaise ?? 0),
    0,
  );

  const currentConversionsByCampaign = new Map<
    string,
    { count: number; valuePaise: number }
  >();
  const currentRepliesByCampaign = new Map<string, number>();

  for (const conversion of currentConversions) {
    const existing = currentConversionsByCampaign.get(conversion.campaignId) ?? {
      count: 0,
      valuePaise: 0,
    };
    existing.count += 1;
    existing.valuePaise += conversion.valuePaise ?? 0;
    currentConversionsByCampaign.set(conversion.campaignId, existing);
  }

  for (const reply of replies) {
    if (reply.repliedAt < currentFrom) continue;
    currentRepliesByCampaign.set(
      reply.campaignId,
      (currentRepliesByCampaign.get(reply.campaignId) ?? 0) + 1,
    );
  }

  const trendMap = new Map<string, DailyPoint>(
    dateSeries(safeDays).map((date) => [date, emptyDailyPoint(date)]),
  );

  for (const event of events) {
    if (event.createdAt < currentFrom) continue;
    const point = trendMap.get(dayKey(event.createdAt));
    if (!point) continue;

    if (event.status === "SENT") point.sent += 1;
    if (event.status === "DELIVERED") point.delivered += 1;
    if (event.status === "READ") point.read += 1;
    if (event.status === "FAILED") point.failed += 1;
  }

  for (const reply of replies) {
    if (reply.repliedAt < currentFrom) continue;
    const point = trendMap.get(dayKey(reply.repliedAt));
    if (point) point.replied += 1;
  }

  const readOnly = Math.max(totals.read - totals.replied, 0);
  const deliveredOnly = Math.max(totals.delivered - totals.read, 0);
  const sentOnly = Math.max(totals.sent - totals.delivered, 0);

  const campaignPerformance = campaigns.map((campaign) => {
    const snapshot = campaign.analyticsSnapshot;
    const sent = snapshot?.sentCount ?? campaign.sentCount;
    const delivered = snapshot?.deliveredCount ?? campaign.deliveredCount;
    const read = snapshot?.readCount ?? campaign.readCount;
    const replied =
      snapshot?.repliedCount ?? currentRepliesByCampaign.get(campaign.id) ?? 0;
    const failed = snapshot?.failedCount ?? campaign.failedCount;
    const costPaise = snapshot?.totalCostPaise ?? 0;
    const conversion = currentConversionsByCampaign.get(campaign.id) ?? {
      count: 0,
      valuePaise: 0,
    };
    const campaignDeliveryRate = safeRate(delivered, sent || campaign.totalContacts);
    const campaignReadRate = safeRate(read, delivered || sent);
    const campaignReplyRate = safeRate(replied, delivered || sent);
    const campaignFailureRate = safeRate(
      failed,
      sent || delivered || campaign.totalContacts,
    );
    const healthScore = clampScore(
      campaignDeliveryRate * 0.35 +
        campaignReadRate * 0.35 +
        campaignReplyRate * 1.2 +
        (100 - campaignFailureRate) * 0.15,
    );

    return {
      costPaise,
      conversionCount: conversion.count,
      delivered,
      deliveryRate: campaignDeliveryRate,
      failed,
      healthScore,
      id: campaign.id,
      name: campaign.name,
      read,
      readRate: campaignReadRate,
      replied,
      replyRate: campaignReplyRate,
      revenuePaise: conversion.valuePaise,
      roiPercent: roiPercent(conversion.valuePaise, costPaise),
      sent,
      status: campaign.status,
      templateName: campaign.template?.name ?? "No template",
    };
  });
  const topCampaigns = campaignPerformance.slice(0, 12);

  const experimentBuckets = new Map<string, typeof campaignPerformance>();
  for (const campaign of campaignPerformance) {
    if (campaign.sent <= 0) continue;
    const key = campaign.templateName;
    experimentBuckets.set(key, [
      ...(experimentBuckets.get(key) ?? []),
      campaign,
    ]);
  }
  const experiments = Array.from(experimentBuckets.entries())
    .map(([templateName, variants]) => {
      const ranked = [...variants].sort((a, b) => {
        if (b.healthScore !== a.healthScore) {
          return b.healthScore - a.healthScore;
        }
        if (b.replyRate !== a.replyRate) return b.replyRate - a.replyRate;
        return b.readRate - a.readRate;
      });
      const winner = ranked[0];
      const baseline = ranked[ranked.length - 1];
      const totalSent = variants.reduce((sum, item) => sum + item.sent, 0);

      return {
        basis: "Same approved template used across multiple campaigns",
        confidence: experimentConfidence(totalSent, variants.length),
        lift: {
          health: winner.healthScore - baseline.healthScore,
          readRate: Math.round((winner.readRate - baseline.readRate) * 100) / 100,
          replyRate:
            Math.round((winner.replyRate - baseline.replyRate) * 100) / 100,
          roiPercent:
            Math.round((winner.roiPercent - baseline.roiPercent) * 100) / 100,
        },
        templateName,
        totalSent,
        variants: ranked.slice(0, 4).map((variant) => ({
          healthScore: variant.healthScore,
          id: variant.id,
          name: variant.name,
          readRate: variant.readRate,
          replyRate: variant.replyRate,
          revenuePaise: variant.revenuePaise,
          roiPercent: variant.roiPercent,
          sent: variant.sent,
        })),
        winner: {
          id: winner.id,
          name: winner.name,
        },
      };
    })
    .filter((experiment) => experiment.variants.length >= 2)
    .sort((a, b) => b.totalSent - a.totalSent)
    .slice(0, 6);

  const campaignComparison = [...campaignPerformance]
    .sort((a, b) => {
      if (b.healthScore !== a.healthScore) return b.healthScore - a.healthScore;
      if (b.roiPercent !== a.roiPercent) return b.roiPercent - a.roiPercent;
      return b.sent - a.sent;
    })
    .slice(0, 8)
    .map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      healthScore: campaign.healthScore,
      readRate: campaign.readRate,
      replyRate: campaign.replyRate,
      roiPercent: campaign.roiPercent,
      sent: campaign.sent,
      templateName: campaign.templateName,
    }));

  const templateBuckets = new Map<string, PerformanceBucket>();
  const languageBuckets = new Map<string, PerformanceBucket>();
  const categoryBuckets = new Map<string, PerformanceBucket>();

  for (const campaign of campaigns) {
    const snapshot = campaign.analyticsSnapshot;
    const sent = snapshot?.sentCount ?? campaign.sentCount;
    const delivered = snapshot?.deliveredCount ?? campaign.deliveredCount;
    const read = snapshot?.readCount ?? campaign.readCount;
    const replied = snapshot?.repliedCount ?? 0;
    const failed = snapshot?.failedCount ?? campaign.failedCount;
    const values = { delivered, failed, read, replied, sent };

    incrementPerformanceBucket(
      templateBuckets,
      campaign.template?.name ?? "No template",
      values,
    );
    incrementPerformanceBucket(
      languageBuckets,
      campaign.template?.language ?? "Unknown language",
      values,
    );
    incrementPerformanceBucket(
      categoryBuckets,
      campaign.template?.category ?? "Unknown category",
      values,
    );
  }

  const replyIntentMap = new Map<string, number>();
  for (const reply of replies) {
    if (reply.repliedAt < currentFrom) continue;
    replyIntentMap.set(
      reply.intent,
      (replyIntentMap.get(reply.intent) ?? 0) + 1,
    );
  }

  const conversionTypeMap = new Map<
    string,
    { count: number; valuePaise: number }
  >();
  for (const conversion of currentConversions) {
    const existing = conversionTypeMap.get(conversion.type) ?? {
      count: 0,
      valuePaise: 0,
    };
    existing.count += 1;
    existing.valuePaise += conversion.valuePaise ?? 0;
    conversionTypeMap.set(conversion.type, existing);
  }

  const failedMessageReasons = new Map<string, number>();
  for (const message of failedMessages) {
    const label = cleanFailureLabel({
      code: message.errorCode,
      fallback: message.errorMessage,
    });
    failedMessageReasons.set(label, (failedMessageReasons.get(label) ?? 0) + 1);
  }

  const fallbackFailureReasons = Array.from(failedMessageReasons.entries())
    .map(([name, value]) => ({
      name,
      retryable: 0,
      severity: "UNKNOWN",
      value,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const deliveryRate = safeRate(
    totals.delivered,
    totals.sent || totals.totalContacts,
  );
  const readRate = safeRate(totals.read, totals.delivered || totals.sent);
  const replyRate = safeRate(totals.replied, totals.delivered || totals.sent);
  const failureRate = safeRate(
    totals.failed,
    totals.sent || totals.delivered || totals.totalContacts,
  );
  const campaignHealthScore = clampScore(
    deliveryRate * 0.35 +
      readRate * 0.35 +
      replyRate * 1.2 +
      (100 - failureRate) * 0.15,
  );
  const audienceQualityScore = clampScore(
    deliveryRate * 0.25 + readRate * 0.45 + replyRate * 1.8 - failureRate * 0.4,
  );

  const hourlyMap = new Map<number, HourlyPoint>(
    Array.from({ length: 24 }, (_, hour) => [hour, emptyHourlyPoint(hour)]),
  );
  const heatmapMap = new Map<
    string,
    { day: string; engagement: number; failed: number; read: number; replied: number; sent: number; window: string }
  >();

  for (const day of dayLabels) {
    for (const window of timeWindows) {
      heatmapMap.set(`${day}:${window.name}`, {
        day,
        engagement: 0,
        failed: 0,
        read: 0,
        replied: 0,
        sent: 0,
        window: window.name,
      });
    }
  }

  for (const event of events) {
    if (event.createdAt < currentFrom) continue;

    const hour = event.createdAt.getHours();
    const hourlyPoint = hourlyMap.get(hour);
    const heatmapPoint = heatmapMap.get(
      `${dayLabels[event.createdAt.getDay()]}:${timeWindowName(hour)}`,
    );

    if (event.status === "SENT") {
      if (hourlyPoint) hourlyPoint.sent += 1;
      if (heatmapPoint) heatmapPoint.sent += 1;
    }

    if (event.status === "READ") {
      if (hourlyPoint) hourlyPoint.read += 1;
      if (heatmapPoint) {
        heatmapPoint.read += 1;
        heatmapPoint.engagement += 1;
      }
    }

    if (event.status === "FAILED") {
      if (hourlyPoint) hourlyPoint.failed += 1;
      if (heatmapPoint) heatmapPoint.failed += 1;
    }
  }

  for (const reply of replies) {
    if (reply.repliedAt < currentFrom) continue;

    const hour = reply.repliedAt.getHours();
    const hourlyPoint = hourlyMap.get(hour);
    const heatmapPoint = heatmapMap.get(
      `${dayLabels[reply.repliedAt.getDay()]}:${timeWindowName(hour)}`,
    );

    if (hourlyPoint) hourlyPoint.replied += 1;
    if (heatmapPoint) {
      heatmapPoint.replied += 1;
      heatmapPoint.engagement += 2;
    }
  }

  const hourly = Array.from(hourlyMap.values());
  const bestTimeWindows = Array.from(heatmapMap.values())
    .filter((item) => item.sent || item.read || item.replied)
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 5)
    .map((item) => ({
      ...item,
      readRate: safeRate(item.read, item.sent),
      replyRate: safeRate(item.replied, item.sent),
    }));

  const recommendations = [
    failureRate >= 8
      ? {
          description:
            "Review the top failure reason groups before the next campaign and retry only safe retry cohorts.",
          title: "Reduce delivery failures",
          tone: "red",
        }
      : null,
    readRate < 25 && totals.sent > 0
      ? {
          description:
            "Test a clearer opening line, stronger offer, or tighter segment before scaling spend.",
          title: "Improve read engagement",
          tone: "amber",
        }
      : null,
    replyRate < 3 && totals.delivered > 0
      ? {
          description:
            "Add a direct question or CTA button so interested customers know how to respond.",
          title: "Prompt more replies",
          tone: "blue",
        }
      : null,
    bestTimeWindows[0]
      ? {
          description: `Your strongest engagement window is ${bestTimeWindows[0].day} ${bestTimeWindows[0].window}. Use it as a scheduling hint, then validate with future sends.`,
          title: "Use the strongest send window",
          tone: "green",
        }
      : null,
  ].filter(
    (
      item,
    ): item is { description: string; title: string; tone: string } =>
      Boolean(item),
  );

  const retryableFailures =
    failureInsights.reduce(
      (sum, insight) => sum + insight.retryableMessageCount,
      0,
    ) || 0;
  const positiveOrQuestionReplies =
    (replyIntentMap.get("POSITIVE") ?? 0) + (replyIntentMap.get("QUESTION") ?? 0);
  const retargeting = [
    {
      action: "Retry after fixing the top failure reason",
      audience: "Retry-safe failed recipients",
      count: retryableFailures,
      priority: retryableFailures > 100 ? "High" : "Medium",
      reason:
        "These customers failed for reasons marked safe to retry by failure intelligence.",
    },
    {
      action: "Send a lighter reminder or stronger opening hook",
      audience: "Delivered but not opened",
      count: deliveredOnly,
      priority: deliveredOnly > totals.read ? "High" : "Medium",
      reason:
        "The message reached the customer but has not produced a read signal yet.",
    },
    {
      action: "Retarget with a direct question or offer deadline",
      audience: "Read but did not reply",
      count: readOnly,
      priority: readOnly > totals.replied ? "High" : "Medium",
      reason:
        "These customers showed interest by reading but have not started a conversation.",
    },
    {
      action: "Assign sales follow-up or launch conversion campaign",
      audience: "High-intent replies",
      count: positiveOrQuestionReplies,
      priority: positiveOrQuestionReplies > 0 ? "High" : "Medium",
      reason:
        "Positive replies and questions are the most valuable retargeting cohort.",
    },
  ].filter((item) => item.count > 0);

  const strongestWindow = bestTimeWindows[0];
  const topFailure = failureInsights[0] ?? null;
  const executiveSummary = [
    `${totals.sent.toLocaleString("en-IN")} messages sent with ${deliveryRate.toFixed(
      1,
    )}% delivery, ${readRate.toFixed(1)}% read, and ${replyRate.toFixed(
      1,
    )}% reply rate.`,
    currentRevenuePaise > 0
      ? `Tracked revenue is INR ${(currentRevenuePaise / 100).toLocaleString(
          "en-IN",
          { maximumFractionDigits: 0 },
        )}, with ROI at ${roiPercent(
          currentRevenuePaise,
          totals.costPaise,
        ).toFixed(1)}% against recorded campaign cost.`
      : "No revenue attribution has been recorded in this period yet.",
    strongestWindow
      ? `${strongestWindow.day} ${strongestWindow.window} is currently the strongest engagement window.`
      : "More timestamped sends are needed before recommending a send-time window.",
    topFailure
      ? `Top failure signal: ${
          topFailure.errorCode ?? topFailure.category
        } with ${topFailure.failedMessageCount.toLocaleString(
          "en-IN",
        )} failed messages.`
      : "No major failure cluster is currently recorded.",
  ];
  const exportFormats = new Set(reportExports.map((report) => report.format));
  const exportReadiness = {
    completedExports: reportExports.length,
    formats: [
      {
        available: exportFormats.has("CSV"),
        label: "CSV",
        note: exportFormats.has("CSV")
          ? "CSV exports have been generated recently."
          : "Campaign completion reports can be downloaded as CSV.",
      },
      {
        available: exportFormats.has("JSON"),
        label: "JSON",
        note: exportFormats.has("JSON")
          ? "JSON exports have been generated recently."
          : "JSON exports are supported by the report model but have not run recently.",
      },
      {
        available: false,
        label: "Excel",
        note: "Excel export generation is not active in the current report flow.",
      },
      {
        available: false,
        label: "PDF",
        note: "PDF report generation is not active in the current report flow.",
      },
    ],
    recentExports: reportExports.map((report) => ({
      createdAt: report.createdAt.toISOString(),
      filename: report.filename,
      format: report.format,
      rowCount: report.rowCount,
      sizeBytes: report.sizeBytes,
    })),
    scheduledReports: {
      available: false,
      note: "Scheduled analytics reports need a dedicated scheduler and recipient preferences before enabling.",
    },
  };

  const overallRoi = roiPercent(currentRevenuePaise, totals.costPaise);
  const decisionBrief = {
    confidence: decisionConfidence({
      campaignCount: campaigns.length,
      conversionCount: currentConversions.length,
      sent: totals.sent,
    }),
    generatedAt: new Date().toISOString(),
    highlights: [
      totals.sent > 0
        ? `${totals.sent.toLocaleString(
            "en-IN",
          )} messages were sent in this range.`
        : "No campaign sends are recorded in this range yet.",
      strongestWindow
        ? `${strongestWindow.day} ${strongestWindow.window} is the strongest observed engagement window.`
        : "No reliable send-time window is available yet.",
      topCampaigns[0]
        ? `${topCampaigns[0].name} is the strongest campaign by current health score.`
        : "No campaign winner can be identified yet.",
      currentRevenuePaise > 0
        ? `Tracked revenue is ${(
            currentRevenuePaise / 100
          ).toLocaleString("en-IN", {
            currency: "INR",
            maximumFractionDigits: 0,
            style: "currency",
          })}.`
        : null,
    ].filter((item): item is string => Boolean(item)),
    nextActions: [
      failureRate >= 8
        ? {
            description:
              "Review the top failure cluster, fix the root cause, then retry only safe failed recipients.",
            owner: "Operations",
            priority: "High",
            title: "Clean failed-recipient cohort",
          }
        : null,
      readRate < 25 && totals.sent > 0
        ? {
            description:
              "Create one clearer copy variant and test it against the current template before the next large send.",
            owner: "Marketing",
            priority: "High",
            title: "Improve opening message",
          }
        : null,
      retargeting[0]
        ? {
            description: `${retargeting[0].count.toLocaleString(
              "en-IN",
            )} customers are ready for ${retargeting[0].action.toLowerCase()}.`,
            owner: "Sales",
            priority: retargeting[0].priority,
            title: `Retarget ${retargeting[0].audience.toLowerCase()}`,
          }
        : null,
      experiments[0]
        ? {
            description: `Use ${experiments[0].winner.name} as the next baseline for ${experiments[0].templateName}.`,
            owner: "Growth",
            priority: experiments[0].confidence === "High" ? "High" : "Medium",
            title: "Promote experiment winner",
          }
        : null,
      {
        description:
          "Export the latest report before making changes so finance and sales teams have the same baseline.",
        owner: "Admin",
        priority: "Medium",
        title: "Share campaign report",
      },
    ].filter(
      (
        item,
      ): item is {
        description: string;
        owner: string;
        priority: string;
        title: string;
      } => Boolean(item),
    ),
    opportunities: [
      strongestWindow
        ? `Schedule the next comparable campaign around ${strongestWindow.day} ${strongestWindow.window}.`
        : "Run more campaigns at different times to build a send-time recommendation.",
      retargeting.length > 0
        ? "Use retargeting cohorts instead of sending the same follow-up to everyone."
        : "Retargeting cohorts will unlock after delivery, read, reply, and failure signals arrive.",
      experiments.length > 0
        ? "Existing campaigns already expose A/B-style learning signals."
        : "Run two variants with the same template to build A/B testing evidence.",
    ],
    risks: [
      failureRate >= 8
        ? `Failure rate is ${failureRate.toFixed(
            1,
          )}%, so scaling now may waste wallet balance.`
        : null,
      readRate < 25 && totals.sent > 0
        ? `Read rate is ${readRate.toFixed(
            1,
          )}%, which suggests weak audience or message fit.`
        : null,
      replyRate < 3 && totals.delivered > 0
        ? `Reply rate is ${replyRate.toFixed(
            1,
          )}%, so CTA quality may need work.`
        : null,
      exportReadiness.scheduledReports.available
        ? null
        : "Scheduled analytics reports are not enabled yet.",
    ].filter((item): item is string => Boolean(item)),
    title: "Generated campaign decision brief",
    verdict: decisionVerdict({
      deliveryRate,
      failureRate,
      readRate,
      replyRate,
      roi: overallRoi,
      sent: totals.sent,
    }),
  };

  return {
    audit: {
      dataSources: [
        "Campaign",
        "CampaignAnalyticsSnapshot",
        "MessageEvent",
        "CampaignReplyAttribution",
        "CampaignConversionEvent",
        "CampaignFailureInsight",
        "CampaignReportExport",
        "ContactSegment",
      ],
      phase:
        "Phase 1 + Phase 2 + Phase 3 + Phase 4 + Phase 5 + Phase 6 + Phase 7",
      rangeDays: safeDays,
    },
    breakdowns: {
      categories: toPerformanceRows(categoryBuckets),
      conversionTypes: Array.from(conversionTypeMap.entries())
        .map(([name, value]) => ({
          name,
          value: value.count,
          valuePaise: value.valuePaise,
        }))
        .sort((a, b) => b.value - a.value),
      failureReasons:
        failureInsights.length > 0
          ? failureInsights.map((insight) => ({
              name: cleanFailureLabel({
                code: insight.errorCode,
                fallback: insight.sampleErrorMessage ?? insight.category,
              }),
              retryable: insight.retryableMessageCount,
              severity: insight.severity,
              value: insight.failedMessageCount,
            }))
          : fallbackFailureReasons,
      languages: toPerformanceRows(languageBuckets),
      replyIntents: Array.from(replyIntentMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
      segments: segments.map((segment) => ({
        id: segment.id,
        lastPreviewAt: segment.lastPreviewAt?.toISOString() ?? null,
        name: segment.name,
        previewCount: segment.lastPreviewCount,
        status: segment.status,
      })),
      templates: toPerformanceRows(templateBuckets),
    },
    engagement: [
      { name: "Replied", value: totals.replied },
      { name: "Read only", value: readOnly },
      { name: "Delivered only", value: deliveredOnly },
      { name: "Sent only", value: sentOnly },
      { name: "Failed", value: totals.failed },
    ].filter((item) => item.value > 0),
    funnel: [
      { name: "Sent", value: totals.sent },
      { name: "Delivered", value: totals.delivered },
      { name: "Read", value: totals.read },
      { name: "Replied", value: totals.replied },
    ],
    kpis: {
      campaigns: {
        trend: trendPercent(
          campaigns.filter((campaign) => campaign.createdAt >= currentFrom)
            .length,
          campaigns.filter((campaign) => campaign.createdAt < currentFrom)
            .length,
        ),
        value: campaigns.length,
      },
      conversions: {
        trend: trendPercent(
          currentConversions.length,
          previousConversions.length,
        ),
        value: currentConversions.length,
      },
      delivered: {
        rate: safeRate(totals.delivered, totals.sent || totals.totalContacts),
        trend: trendPercent(currentDelivered, previousDelivered),
        value: totals.delivered,
      },
      read: {
        rate: safeRate(totals.read, totals.delivered || totals.sent),
        trend: trendPercent(currentRead, previousRead),
        value: totals.read,
      },
      replied: {
        rate: safeRate(totals.replied, totals.delivered || totals.sent),
        trend: trendPercent(currentReplies, previousReplies),
        value: totals.replied,
      },
      revenue: {
        trend: trendPercent(currentRevenuePaise, previousRevenuePaise),
        valuePaise: currentRevenuePaise,
      },
      sent: {
        trend: trendPercent(currentSent, previousSent),
        value: totals.sent,
      },
    },
    intelligence: {
      campaignComparison,
      decisionBrief,
      executiveSummary,
      experiments,
      exportReadiness,
      retargeting,
      revenueAttribution: {
        conversionRate: safeRate(currentConversions.length, totals.sent),
        costPaise: totals.costPaise,
        costPerDeliveredPaise: paisePerUnit(totals.costPaise, totals.delivered),
        costPerReadPaise: paisePerUnit(totals.costPaise, totals.read),
        netPaise: currentRevenuePaise - totals.costPaise,
        revenuePaise: currentRevenuePaise,
        revenuePerConversionPaise: paisePerUnit(
          currentRevenuePaise,
          currentConversions.length,
        ),
        revenuePerReplyPaise: paisePerUnit(currentRevenuePaise, totals.replied),
        roiPercent: roiPercent(currentRevenuePaise, totals.costPaise),
      },
    },
    recommendations,
    scores: {
      audienceQuality: {
        grade: scoreGrade(audienceQualityScore),
        reasons: scoreReasons({
          deliveryRate,
          failureRate,
          readRate,
          replyRate,
        }),
        score: audienceQualityScore,
      },
      campaignHealth: {
        grade: scoreGrade(campaignHealthScore),
        reasons: scoreReasons({
          deliveryRate,
          failureRate,
          readRate,
          replyRate,
        }),
        score: campaignHealthScore,
      },
    },
    timing: {
      bestTimeWindows,
      heatmap: Array.from(heatmapMap.values()),
      hourly,
    },
    topCampaigns,
    totals,
    trend: Array.from(trendMap.values()),
  };
}
