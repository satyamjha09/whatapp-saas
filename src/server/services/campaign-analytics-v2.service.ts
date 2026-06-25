import type { MessageStatus } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createIncident } from "@/server/services/incident.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";

function isEnabled() {
  return process.env.CAMPAIGN_ANALYTICS_V2_ENABLED !== "false";
}

function getReplyAttributionWindowHours() {
  const parsed = Number(
    process.env.CAMPAIGN_REPLY_ATTRIBUTION_WINDOW_HOURS ?? 168,
  );

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 168;
}

function getSyncLimit() {
  const parsed = Number(process.env.CAMPAIGN_ANALYTICS_SYNC_LIMIT ?? 50);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
}

function rateBps(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;

  return Math.round((numerator / denominator) * 10_000);
}

function maxDate(values: Array<Date | null | undefined>) {
  const valid = values.filter(Boolean) as Date[];

  if (valid.length === 0) return null;

  return new Date(Math.max(...valid.map((date) => date.getTime())));
}

function minDate(values: Array<Date | null | undefined>) {
  const valid = values.filter(Boolean) as Date[];

  if (valid.length === 0) return null;

  return new Date(Math.min(...valid.map((date) => date.getTime())));
}

function statusCount(
  messages: Array<{ status: MessageStatus }>,
  status: MessageStatus,
) {
  return messages.filter((message) => message.status === status).length;
}

function normalizeMetadata(value: unknown) {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

export async function syncCampaignReplyAttributions({
  companyId,
  campaignId,
}: {
  companyId: string;
  campaignId: string;
}) {
  const campaign = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      companyId,
    },
    include: {
      contacts: {
        select: {
          contactId: true,
        },
      },
    },
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const contactIds = campaign.contacts.map((item) => item.contactId);

  if (contactIds.length === 0) {
    return {
      attributed: 0,
    };
  }

  const attributionEndsAt = new Date(
    campaign.createdAt.getTime() +
      getReplyAttributionWindowHours() * 60 * 60 * 1000,
  );

  const inboundReplies = await prisma.message.findMany({
    where: {
      companyId,
      contactId: {
        in: contactIds,
      },
      direction: "INBOUND",
      createdAt: {
        gte: campaign.createdAt,
        lte: attributionEndsAt,
      },
    },
    select: {
      id: true,
      contactId: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 10_000,
  });

  let attributed = 0;

  for (const reply of inboundReplies) {
    await prisma.campaignReplyAttribution.upsert({
      where: {
        campaignId_messageId: {
          campaignId,
          messageId: reply.id,
        },
      },
      create: {
        companyId,
        campaignId,
        contactId: reply.contactId,
        messageId: reply.id,
        source: "AUTO",
        repliedAt: reply.createdAt,
      },
      update: {
        repliedAt: reply.createdAt,
      },
    });

    attributed += 1;
  }

  return {
    attributed,
  };
}

export async function syncCampaignAnalyticsSnapshot({
  companyId,
  campaignId,
}: {
  companyId: string;
  campaignId: string;
}) {
  if (!isEnabled()) {
    return {
      skipped: true,
      reason: "Campaign Analytics v2 disabled",
    };
  }

  const campaign = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      companyId,
    },
    include: {
      contacts: {
        select: {
          contactId: true,
          status: true,
        },
      },
      messages: {
        select: {
          id: true,
          contactId: true,
          status: true,
          direction: true,
          createdAt: true,
        },
      },
    },
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  try {
    await syncCampaignReplyAttributions({
      companyId,
      campaignId,
    });

    const outboundMessages = campaign.messages.filter(
      (message) => message.direction === "OUTBOUND",
    );
    const messageIds = outboundMessages.map((message) => message.id);
    const contactIds = campaign.contacts.map((item) => item.contactId);

    const [replyCount, lastReply, optOutCount, cost] = await Promise.all([
      prisma.campaignReplyAttribution.count({
        where: {
          companyId,
          campaignId,
        },
      }),

      prisma.campaignReplyAttribution.findFirst({
        where: {
          companyId,
          campaignId,
        },
        orderBy: {
          repliedAt: "desc",
        },
        select: {
          repliedAt: true,
        },
      }),

      prisma.contact.count({
        where: {
          companyId,
          id: {
            in: contactIds,
          },
          optedOutAt: {
            gte: campaign.createdAt,
          },
        },
      }),

      messageIds.length > 0
        ? prisma.messageUsageLedger.aggregate({
            where: {
              companyId,
              messageId: {
                in: messageIds,
              },
              status: "CHARGED",
            },
            _sum: {
              amountPaise: true,
            },
            _count: {
              id: true,
            },
          })
        : Promise.resolve({
            _sum: {
              amountPaise: 0,
            },
            _count: {
              id: 0,
            },
          }),
    ]);

    const totalContacts = campaign.contacts.length || campaign.totalContacts || 0;
    const queuedCount =
      statusCount(outboundMessages, "QUEUED") +
      statusCount(outboundMessages, "SENDING") +
      statusCount(outboundMessages, "RETRY_PENDING");
    const sentCount =
      statusCount(outboundMessages, "SENT") +
      statusCount(outboundMessages, "DELIVERED") +
      statusCount(outboundMessages, "READ");
    const deliveredCount =
      statusCount(outboundMessages, "DELIVERED") +
      statusCount(outboundMessages, "READ");
    const readCount = statusCount(outboundMessages, "READ");
    const failedCount = statusCount(outboundMessages, "FAILED");
    const firstMessageAt = minDate(
      outboundMessages.map((message) => message.createdAt),
    );
    const lastMessageAt = maxDate(
      outboundMessages.map((message) => message.createdAt),
    );

    const snapshot = await prisma.campaignAnalyticsSnapshot.upsert({
      where: {
        campaignId,
      },
      create: {
        companyId,
        campaignId,
        status: "FRESH",
        totalContacts,
        queuedCount,
        sentCount,
        deliveredCount,
        readCount,
        failedCount,
        repliedCount: replyCount,
        optedOutCount: optOutCount,
        chargedCount: cost._count.id ?? 0,
        totalCostPaise: cost._sum.amountPaise ?? 0,
        sentRateBps: rateBps(sentCount, totalContacts),
        deliveredRateBps: rateBps(deliveredCount, totalContacts),
        readRateBps: rateBps(readCount, totalContacts),
        replyRateBps: rateBps(replyCount, totalContacts),
        optOutRateBps: rateBps(optOutCount, totalContacts),
        failureRateBps: rateBps(failedCount, totalContacts),
        firstMessageAt,
        lastMessageAt,
        lastReplyAt: lastReply?.repliedAt ?? null,
        lastSyncedAt: new Date(),
        metadata: normalizeMetadata({
          attributionWindowHours: getReplyAttributionWindowHours(),
        }),
      },
      update: {
        status: "FRESH",
        totalContacts,
        queuedCount,
        sentCount,
        deliveredCount,
        readCount,
        failedCount,
        repliedCount: replyCount,
        optedOutCount: optOutCount,
        chargedCount: cost._count.id ?? 0,
        totalCostPaise: cost._sum.amountPaise ?? 0,
        sentRateBps: rateBps(sentCount, totalContacts),
        deliveredRateBps: rateBps(deliveredCount, totalContacts),
        readRateBps: rateBps(readCount, totalContacts),
        replyRateBps: rateBps(replyCount, totalContacts),
        optOutRateBps: rateBps(optOutCount, totalContacts),
        failureRateBps: rateBps(failedCount, totalContacts),
        firstMessageAt,
        lastMessageAt,
        lastReplyAt: lastReply?.repliedAt ?? null,
        lastSyncedAt: new Date(),
        errorMessage: null,
        metadata: normalizeMetadata({
          attributionWindowHours: getReplyAttributionWindowHours(),
        }),
      },
    });

    return {
      skipped: false,
      snapshot,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown campaign analytics error";

    await prisma.campaignAnalyticsSnapshot.upsert({
      where: {
        campaignId,
      },
      create: {
        companyId,
        campaignId,
        status: "FAILED",
        errorMessage: message,
        lastSyncedAt: new Date(),
      },
      update: {
        status: "FAILED",
        errorMessage: message,
        lastSyncedAt: new Date(),
      },
    });

    await createIncident({
      companyId,
      title: "Campaign analytics sync failed",
      description: message,
      source: "SYSTEM",
      severity: "MEDIUM",
      idempotencyKey: `campaign-analytics-failed:${campaignId}`,
      metadata: {
        campaignId,
      },
    }).catch(() => undefined);

    throw error;
  }
}

export async function syncRecentCampaignAnalytics() {
  const campaigns = await prisma.campaign.findMany({
    where: {
      status: {
        in: ["SCHEDULED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"],
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: getSyncLimit(),
    select: {
      id: true,
      companyId: true,
    },
  });

  const results = [];

  for (const campaign of campaigns) {
    results.push(
      await syncCampaignAnalyticsSnapshot({
        companyId: campaign.companyId,
        campaignId: campaign.id,
      }),
    );
  }

  return {
    checked: campaigns.length,
    results,
  };
}

export async function getCampaignAnalyticsList({
  companyId,
  take = 100,
}: {
  companyId: string;
  take?: number;
}) {
  return prisma.campaign.findMany({
    where: {
      companyId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take,
    include: {
      template: true,
      analyticsSnapshot: true,
    },
  });
}

export async function getCampaignAnalyticsDetail({
  companyId,
  campaignId,
}: {
  companyId: string;
  campaignId: string;
}) {
  return prisma.campaign.findFirst({
    where: {
      id: campaignId,
      companyId,
    },
    include: {
      template: true,
      analyticsSnapshot: true,
      contacts: {
        include: {
          contact: true,
        },
        take: 500,
        orderBy: {
          createdAt: "desc",
        },
      },
      messages: {
        orderBy: {
          createdAt: "desc",
        },
        take: 200,
        include: {
          contact: true,
        },
      },
      replyAttributions: {
        orderBy: {
          repliedAt: "desc",
        },
        take: 100,
        include: {
          contact: true,
          message: true,
        },
      },
    },
  });
}

export async function getCampaignAnalyticsHealth() {
  const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [failedSnapshots, staleSnapshots, synced24h] = await Promise.all([
    prisma.campaignAnalyticsSnapshot.count({
      where: {
        status: "FAILED",
      },
    }),

    prisma.campaignAnalyticsSnapshot.count({
      where: {
        status: {
          not: "FAILED",
        },
        lastSyncedAt: {
          lt: staleThreshold,
        },
      },
    }),

    prisma.campaignAnalyticsSnapshot.count({
      where: {
        lastSyncedAt: {
          gte: staleThreshold,
        },
      },
    }),
  ]);

  return {
    enabled: isEnabled(),
    failedSnapshots,
    staleSnapshots,
    synced24h,
    isHealthy: isEnabled() && failedSnapshots === 0,
  };
}

export function campaignAnalyticsToCsvRow(
  campaign: Awaited<ReturnType<typeof getCampaignAnalyticsList>>[number],
) {
  const snapshot = campaign.analyticsSnapshot;

  return [
    campaign.id,
    campaign.name,
    campaign.status,
    campaign.template?.name ?? "",
    snapshot?.totalContacts ?? campaign.totalContacts,
    snapshot?.sentCount ?? campaign.sentCount,
    snapshot?.deliveredCount ?? campaign.deliveredCount,
    snapshot?.readCount ?? campaign.readCount,
    snapshot?.failedCount ?? campaign.failedCount,
    snapshot?.repliedCount ?? 0,
    snapshot?.optedOutCount ?? 0,
    snapshot?.totalCostPaise ?? 0,
    ((snapshot?.sentRateBps ?? 0) / 100).toFixed(2),
    ((snapshot?.deliveredRateBps ?? 0) / 100).toFixed(2),
    ((snapshot?.readRateBps ?? 0) / 100).toFixed(2),
    ((snapshot?.replyRateBps ?? 0) / 100).toFixed(2),
    ((snapshot?.optOutRateBps ?? 0) / 100).toFixed(2),
    campaign.createdAt.toISOString(),
    snapshot?.lastSyncedAt?.toISOString() ?? "",
  ];
}
