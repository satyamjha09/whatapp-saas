import { prisma } from "@/lib/prisma";

export type CampaignActivityFeedItem = {
  id: string;
  campaignId: string;
  createdAt: Date;
  description: string | null;
  kind:
    | "CAMPAIGN"
    | "CONTROL"
    | "CONVERSION"
    | "FAILURE"
    | "FOLLOW_UP"
    | "MESSAGE"
    | "REPLY"
    | "REPORT";
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
};

function sortFeed(items: CampaignActivityFeedItem[]) {
  return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

function statusSeverity(status?: string | null): CampaignActivityFeedItem["severity"] {
  if (!status) return "INFO";
  if (["FAILED", "CANCELED", "PAUSED"].includes(status)) return "CRITICAL";
  if (["SENDING", "QUEUED", "DRAFT"].includes(status)) return "WARNING";
  return "INFO";
}

function failureSeverity(severity: string): CampaignActivityFeedItem["severity"] {
  if (severity === "CRITICAL") return "CRITICAL";
  if (severity === "WARNING") return "WARNING";
  return "INFO";
}

function replySeverity(intent: string): CampaignActivityFeedItem["severity"] {
  return intent === "OPT_OUT" ? "WARNING" : "INFO";
}

function conversionSeverity(type: string): CampaignActivityFeedItem["severity"] {
  return type === "LEAD_LOST" ? "WARNING" : "INFO";
}

function taskSeverity(priority: string): CampaignActivityFeedItem["severity"] {
  return priority === "HIGH" ? "WARNING" : "INFO";
}

function messageSeverity(status: string): CampaignActivityFeedItem["severity"] {
  return status === "FAILED" ? "CRITICAL" : "INFO";
}

export async function getCampaignActivityFeed({
  campaignId,
  companyId,
  take = 100,
}: {
  campaignId?: string | null;
  companyId: string;
  take?: number;
}) {
  const where = {
    companyId,
    ...(campaignId ? { campaignId } : {}),
  };

  const [
    campaigns,
    launchRuns,
    throughputEvents,
    failureInsights,
    reports,
    replies,
    conversions,
    followUps,
    messages,
  ] = await Promise.all([
    prisma.campaign.findMany({
      where: {
        companyId,
        ...(campaignId ? { id: campaignId } : {}),
      },
      orderBy: {
        updatedAt: "desc",
      },
      take,
      select: {
        id: true,
        name: true,
        status: true,
        updatedAt: true,
      },
    }),
    prisma.campaignLaunchRun.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take,
    }),
    prisma.campaignThroughputEvent.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take,
    }),
    prisma.campaignFailureInsight.findMany({
      where,
      orderBy: {
        lastSeenAt: "desc",
      },
      take,
    }),
    prisma.campaignCompletionReport.findMany({
      where,
      orderBy: {
        generatedAt: "desc",
      },
      take,
    }),
    prisma.campaignReplyAttribution.findMany({
      where,
      orderBy: {
        replyReceivedAt: "desc",
      },
      take,
    }),
    prisma.campaignConversionEvent.findMany({
      where,
      orderBy: {
        occurredAt: "desc",
      },
      take,
    }),
    prisma.campaignFollowUpTask.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take,
    }),
    prisma.message.findMany({
      where: {
        companyId,
        campaignId: campaignId ? campaignId : { not: null },
      },
      orderBy: {
        createdAt: "desc",
      },
      take,
      select: {
        body: true,
        campaignId: true,
        createdAt: true,
        direction: true,
        errorCode: true,
        errorMessage: true,
        id: true,
        status: true,
      },
    }),
  ]);

  const items: CampaignActivityFeedItem[] = [
    ...campaigns.map((campaign) => ({
      id: `campaign:${campaign.id}`,
      campaignId: campaign.id,
      createdAt: campaign.updatedAt,
      description: campaign.name,
      kind: "CAMPAIGN" as const,
      severity: statusSeverity(campaign.status),
      title: `Campaign status - ${campaign.status}`,
    })),
    ...launchRuns.map((run) => ({
      id: `launch:${run.id}`,
      campaignId: run.campaignId,
      createdAt: run.updatedAt,
      description:
        run.failureReason ??
        `${run.createdMessageCount} messages created, ${run.queuedMessageCount} queued`,
      kind: "CONTROL" as const,
      severity: statusSeverity(run.status),
      title: `Launch run - ${run.status}`,
    })),
    ...throughputEvents.map((event) => ({
      id: `throughput:${event.id}`,
      campaignId: event.campaignId,
      createdAt: event.createdAt,
      description: event.errorMessage ?? event.message,
      kind: "CONTROL" as const,
      severity: event.severity,
      title: `${event.type} - ${event.title}`,
    })),
    ...failureInsights.map((insight) => ({
      id: `failure:${insight.id}`,
      campaignId: insight.campaignId,
      createdAt: insight.lastSeenAt ?? insight.updatedAt,
      description:
        insight.sampleErrorMessage ??
        `${insight.failedMessageCount} failed, ${insight.retryableMessageCount} retryable`,
      kind: "FAILURE" as const,
      severity: failureSeverity(insight.severity),
      title: `${insight.category} - ${insight.status}`,
    })),
    ...reports.map((report) => ({
      id: `report:${report.id}`,
      campaignId: report.campaignId,
      createdAt: report.generatedAt,
      description: `${report.sentMessages} sent, ${report.failedMessages} failed, ${report.replyCount} replies`,
      kind: "REPORT" as const,
      severity: statusSeverity(report.status),
      title: `Final report - ${report.status}`,
    })),
    ...replies.map((reply) => ({
      id: `reply:${reply.id}`,
      campaignId: reply.campaignId,
      createdAt: reply.replyReceivedAt,
      description: reply.replyBodyPreview,
      kind: "REPLY" as const,
      severity: replySeverity(reply.intent),
      title: `Reply intent - ${reply.intent}`,
    })),
    ...conversions.map((conversion) => ({
      id: `conversion:${conversion.id}`,
      campaignId: conversion.campaignId,
      createdAt: conversion.occurredAt,
      description: conversion.note,
      kind: "CONVERSION" as const,
      severity: conversionSeverity(conversion.type),
      title: `Conversion - ${conversion.type}`,
    })),
    ...followUps.map((task) => ({
      id: `follow-up:${task.id}`,
      campaignId: task.campaignId,
      createdAt: task.createdAt,
      description: task.description,
      kind: "FOLLOW_UP" as const,
      severity: taskSeverity(task.priority),
      title: `Follow-up - ${task.status}`,
    })),
    ...messages.map((message) => ({
      id: `message:${message.id}`,
      campaignId: message.campaignId ?? "",
      createdAt: message.createdAt,
      description: message.errorMessage ?? message.body,
      kind: "MESSAGE" as const,
      severity: messageSeverity(message.status),
      title: `${message.direction} message - ${message.status}`,
    })),
  ].filter((item) => item.campaignId);

  return {
    items: sortFeed(items).slice(0, take),
  };
}
