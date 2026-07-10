import { Prisma } from "@/generated/prisma/client";
import {
  safePercent,
  WHATSAPP_FLOW_ANALYTICS_METRICS,
  type WhatsAppFlowAnalyticsMetricKey,
} from "@/lib/whatsapp-flow-analytics";
import { prisma } from "@/lib/prisma";
import type { WhatsAppFlowAnalyticsQuery } from "@/server/validators/whatsapp-flow-analytics.validator";

const DAY_MS = 24 * 60 * 60 * 1000;
const DELIVERED_STATUSES = new Set(["DELIVERED", "READ"]);
const READ_STATUSES = new Set(["READ"]);

type FlowAnalyticsInteraction = Awaited<
  ReturnType<typeof loadFlowInteractions>
>[number];

export type WhatsAppFlowAnalyticsSource = "ALL" | "MANUAL" | "AUTOMATION";

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function endOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

function resolveDateRange(filters: WhatsAppFlowAnalyticsQuery) {
  const endDate = filters.endDate ?? endOfUtcDay(new Date());

  if (filters.range === "custom" && filters.startDate && filters.endDate) {
    return {
      endDate: filters.endDate,
      startDate: filters.startDate,
    };
  }

  const days = filters.range === "7d" ? 7 : filters.range === "90d" ? 90 : 30;
  const end = endOfUtcDay(endDate);
  const start = startOfUtcDay(new Date(end.getTime() - (days - 1) * DAY_MS));

  return {
    endDate: end,
    startDate: start,
  };
}

function buildBaseWhere(
  companyId: string,
  filters: WhatsAppFlowAnalyticsQuery,
): Prisma.WhatsAppFlowInteractionWhereInput {
  return {
    companyId,
    ...(filters.flowAssetId ? { flowAssetId: filters.flowAssetId } : {}),
    ...(filters.templateId ? { templateId: filters.templateId } : {}),
    ...(filters.source === "AUTOMATION"
      ? {
          automationExecutionId: {
            not: null,
          },
        }
      : {}),
    ...(filters.source === "MANUAL"
      ? {
          automationExecutionId: null,
        }
      : {}),
  };
}

async function loadFlowInteractions(
  where: Prisma.WhatsAppFlowInteractionWhereInput,
) {
  return prisma.whatsAppFlowInteraction.findMany({
    orderBy: {
      sentAt: "asc",
    },
    select: {
      automationExecutionId: true,
      automationResumeQueuedAt: true,
      completedAt: true,
      convertedAt: true,
      failedAt: true,
      flowAsset: {
        select: {
          id: true,
          name: true,
        },
      },
      flowAssetId: true,
      id: true,
      message: {
        select: {
          events: {
            orderBy: {
              createdAt: "asc",
            },
            select: {
              createdAt: true,
              status: true,
            },
          },
          status: true,
        },
      },
      response: {
        select: {
          processedAt: true,
          status: true,
        },
      },
      sentAt: true,
      status: true,
      template: {
        select: {
          category: true,
          id: true,
          language: true,
          name: true,
        },
      },
      templateId: true,
    },
    where,
  });
}

function messageHasStatus(
  interaction: FlowAnalyticsInteraction,
  statuses: Set<string>,
) {
  if (interaction.message?.status && statuses.has(interaction.message.status)) {
    return true;
  }

  return Boolean(
    interaction.message?.events.some((event) => statuses.has(event.status)),
  );
}

function firstMessageEventDate(
  interaction: FlowAnalyticsInteraction,
  statuses: Set<string>,
  startDate: Date,
  endDate: Date,
) {
  return (
    interaction.message?.events.find(
      (event) =>
        statuses.has(event.status) &&
        event.createdAt >= startDate &&
        event.createdAt <= endDate,
    )?.createdAt ?? null
  );
}

function isProcessed(interaction: FlowAnalyticsInteraction) {
  return (
    interaction.response?.status === "PROCESSED" &&
    Boolean(interaction.response.processedAt)
  );
}

function isFailed(interaction: FlowAnalyticsInteraction) {
  return (
    interaction.status === "FAILED" ||
    Boolean(interaction.failedAt) ||
    interaction.message?.status === "FAILED"
  );
}

function emptyCounts() {
  return {
    automationResumed: 0,
    businessConverted: 0,
    completed: 0,
    delivered: 0,
    failed: 0,
    processed: 0,
    read: 0,
    sent: 0,
  };
}

function countCohort(interactions: FlowAnalyticsInteraction[]) {
  const counts = emptyCounts();

  counts.sent = interactions.filter((interaction) => interaction.sentAt).length;
  counts.delivered = interactions.filter((interaction) =>
    messageHasStatus(interaction, DELIVERED_STATUSES),
  ).length;
  counts.read = interactions.filter((interaction) =>
    messageHasStatus(interaction, READ_STATUSES),
  ).length;
  counts.completed = interactions.filter((interaction) =>
    Boolean(interaction.completedAt),
  ).length;
  counts.processed = interactions.filter(isProcessed).length;
  counts.automationResumed = interactions.filter((interaction) =>
    Boolean(interaction.automationResumeQueuedAt),
  ).length;
  counts.businessConverted = interactions.filter((interaction) =>
    Boolean(interaction.convertedAt),
  ).length;
  counts.failed = interactions.filter(isFailed).length;

  return counts;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildTrendBuckets(startDate: Date, endDate: Date) {
  const buckets = new Map<
    string,
    { date: string } & ReturnType<typeof emptyCounts>
  >();
  const cursor = startOfUtcDay(startDate);
  const final = startOfUtcDay(endDate);

  while (cursor <= final) {
    const key = dateKey(cursor);
    buckets.set(key, {
      date: key,
      ...emptyCounts(),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return buckets;
}

function incrementBucket(
  buckets: ReturnType<typeof buildTrendBuckets>,
  date: Date | null | undefined,
  metric: WhatsAppFlowAnalyticsMetricKey,
) {
  if (!date) return;

  const bucket = buckets.get(dateKey(date));
  if (!bucket) return;

  bucket[metric] += 1;
}

function buildTrend(
  interactions: FlowAnalyticsInteraction[],
  startDate: Date,
  endDate: Date,
) {
  const buckets = buildTrendBuckets(startDate, endDate);

  for (const interaction of interactions) {
    if (
      interaction.sentAt &&
      interaction.sentAt >= startDate &&
      interaction.sentAt <= endDate
    ) {
      incrementBucket(buckets, interaction.sentAt, "sent");
    }

    incrementBucket(
      buckets,
      firstMessageEventDate(
        interaction,
        DELIVERED_STATUSES,
        startDate,
        endDate,
      ),
      "delivered",
    );
    incrementBucket(
      buckets,
      firstMessageEventDate(interaction, READ_STATUSES, startDate, endDate),
      "read",
    );

    if (
      interaction.completedAt &&
      interaction.completedAt >= startDate &&
      interaction.completedAt <= endDate
    ) {
      incrementBucket(buckets, interaction.completedAt, "completed");
    }

    if (
      interaction.response?.processedAt &&
      interaction.response.processedAt >= startDate &&
      interaction.response.processedAt <= endDate &&
      interaction.response.status === "PROCESSED"
    ) {
      incrementBucket(buckets, interaction.response.processedAt, "processed");
    }

    if (
      interaction.automationResumeQueuedAt &&
      interaction.automationResumeQueuedAt >= startDate &&
      interaction.automationResumeQueuedAt <= endDate
    ) {
      incrementBucket(
        buckets,
        interaction.automationResumeQueuedAt,
        "automationResumed",
      );
    }

    if (
      interaction.convertedAt &&
      interaction.convertedAt >= startDate &&
      interaction.convertedAt <= endDate
    ) {
      incrementBucket(buckets, interaction.convertedAt, "businessConverted");
    }

    if (
      interaction.failedAt &&
      interaction.failedAt >= startDate &&
      interaction.failedAt <= endDate
    ) {
      incrementBucket(buckets, interaction.failedAt, "failed");
    }
  }

  return Array.from(buckets.values());
}

function aggregateByFlow(interactions: FlowAnalyticsInteraction[]) {
  const byFlow = new Map<
    string,
    {
      businessConverted: number;
      completed: number;
      flowId: string;
      name: string;
      sent: number;
    }
  >();

  for (const interaction of interactions) {
    const item =
      byFlow.get(interaction.flowAssetId) ??
      {
        businessConverted: 0,
        completed: 0,
        flowId: interaction.flowAssetId,
        name: interaction.flowAsset.name,
        sent: 0,
      };

    item.sent += interaction.sentAt ? 1 : 0;
    item.completed += interaction.completedAt ? 1 : 0;
    item.businessConverted += interaction.convertedAt ? 1 : 0;
    byFlow.set(interaction.flowAssetId, item);
  }

  return Array.from(byFlow.values())
    .map((item) => ({
      ...item,
      businessConversionRate: safePercent(item.businessConverted, item.sent),
      completionRate: safePercent(item.completed, item.sent),
    }))
    .sort((a, b) => b.sent - a.sent || b.completed - a.completed);
}

function aggregateByTemplate(interactions: FlowAnalyticsInteraction[]) {
  const byTemplate = new Map<
    string,
    {
      businessConverted: number;
      category: string;
      completed: number;
      language: string;
      name: string;
      sent: number;
      templateId: string;
    }
  >();

  for (const interaction of interactions) {
    const item =
      byTemplate.get(interaction.templateId) ??
      {
        businessConverted: 0,
        category: interaction.template.category,
        completed: 0,
        language: interaction.template.language,
        name: interaction.template.name,
        sent: 0,
        templateId: interaction.templateId,
      };

    item.sent += interaction.sentAt ? 1 : 0;
    item.completed += interaction.completedAt ? 1 : 0;
    item.businessConverted += interaction.convertedAt ? 1 : 0;
    byTemplate.set(interaction.templateId, item);
  }

  return Array.from(byTemplate.values())
    .map((item) => ({
      ...item,
      businessConversionRate: safePercent(item.businessConverted, item.sent),
      completionRate: safePercent(item.completed, item.sent),
    }))
    .sort((a, b) => b.sent - a.sent || b.completed - a.completed);
}

export async function markFlowInteractionConvertedForAutomationNode({
  automationExecutionId,
  companyId,
  reachedNodeId,
}: {
  automationExecutionId: string;
  companyId: string;
  reachedNodeId: string;
}) {
  if (!automationExecutionId || !reachedNodeId) {
    return {
      converted: 0,
    };
  }

  const result = await prisma.whatsAppFlowInteraction.updateMany({
    data: {
      convertedAt: new Date(),
      conversionKey: reachedNodeId,
      conversionSource: "AUTOMATION_NODE",
    },
    where: {
      automationExecutionId,
      companyId,
      conversionGoalNodeId: reachedNodeId,
      convertedAt: null,
    },
  });

  return {
    converted: result.count,
  };
}

export async function getWhatsAppFlowAnalytics(
  companyId: string,
  filters: WhatsAppFlowAnalyticsQuery,
) {
  const { endDate, startDate } = resolveDateRange(filters);
  const baseWhere = buildBaseWhere(companyId, filters);
  const cohortWhere: Prisma.WhatsAppFlowInteractionWhereInput = {
    ...baseWhere,
    sentAt: {
      gte: startDate,
      lte: endDate,
    },
  };
  const activityWhere: Prisma.WhatsAppFlowInteractionWhereInput = {
    ...baseWhere,
    OR: [
      {
        sentAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      {
        completedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      {
        convertedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      {
        failedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      {
        automationResumeQueuedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      {
        response: {
          is: {
            processedAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
      },
      {
        message: {
          is: {
            events: {
              some: {
                createdAt: {
                  gte: startDate,
                  lte: endDate,
                },
                status: {
                  in: ["DELIVERED", "READ"],
                },
              },
            },
          },
        },
      },
    ],
  };

  const [cohortInteractions, activityInteractions, flowOptions, templateOptions] =
    await Promise.all([
      loadFlowInteractions(cohortWhere),
      loadFlowInteractions(activityWhere),
      prisma.whatsAppFlow.findMany({
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          remoteStatus: true,
          status: true,
        },
        where: {
          companyId,
        },
      }),
      prisma.template.findMany({
        orderBy: {
          name: "asc",
        },
        select: {
          category: true,
          id: true,
          language: true,
          name: true,
          status: true,
        },
        where: {
          companyId,
          whatsAppFlowInteractions: {
            some: {},
          },
        },
      }),
    ]);

  const summary = countCohort(cohortInteractions);

  return {
    dateRange: {
      endDate: endDate.toISOString(),
      range: filters.range,
      startDate: startDate.toISOString(),
    },
    filters: {
      flowAssetId: filters.flowAssetId ?? null,
      source: filters.source,
      templateId: filters.templateId ?? null,
    },
    flowOptions,
    funnel: [
      {
        count: summary.sent,
        metric: "sent",
        rateFromPrevious: null,
        rateFromSent: safePercent(summary.sent, summary.sent),
      },
      {
        count: summary.delivered,
        metric: "delivered",
        rateFromPrevious: safePercent(summary.delivered, summary.sent),
        rateFromSent: safePercent(summary.delivered, summary.sent),
      },
      {
        count: summary.read,
        metric: "read",
        rateFromPrevious: safePercent(summary.read, summary.delivered),
        rateFromSent: safePercent(summary.read, summary.sent),
      },
      {
        count: summary.completed,
        metric: "completed",
        rateFromPrevious: safePercent(summary.completed, summary.read),
        rateFromSent: safePercent(summary.completed, summary.sent),
      },
      {
        count: summary.processed,
        metric: "processed",
        rateFromPrevious: safePercent(summary.processed, summary.completed),
        rateFromSent: safePercent(summary.processed, summary.sent),
      },
      {
        count: summary.automationResumed,
        metric: "automationResumed",
        rateFromPrevious: safePercent(
          summary.automationResumed,
          summary.processed,
        ),
        rateFromSent: safePercent(summary.automationResumed, summary.sent),
      },
      {
        count: summary.businessConverted,
        metric: "businessConverted",
        rateFromPrevious: null,
        rateFromSent: safePercent(summary.businessConverted, summary.sent),
      },
    ],
    metricDefinitions: WHATSAPP_FLOW_ANALYTICS_METRICS,
    summary: {
      ...summary,
      completionRate: safePercent(summary.completed, summary.sent),
      deliveredRate: safePercent(summary.delivered, summary.sent),
      readRate: safePercent(summary.read, summary.delivered),
    },
    templateOptions,
    topFlows: aggregateByFlow(cohortInteractions),
    topTemplates: aggregateByTemplate(cohortInteractions),
    trend: buildTrend(activityInteractions, startDate, endDate),
  };
}
