import { ContactActivityType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { recordContactActivity } from "@/server/services/contact-activity.service";

type BackfillCounters = {
  scanned: number;
  createdOrUpdated: number;
  skipped: number;
};

function emptyCounters(): BackfillCounters {
  return {
    createdOrUpdated: 0,
    scanned: 0,
    skipped: 0,
  };
}

function preview(value?: string | null) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 180);
}

async function hasDedupeKeyColumn() {
  try {
    await prisma.$queryRaw`SELECT "dedupeKey" FROM "ContactActivity" LIMIT 0`;
    return true;
  } catch {
    return false;
  }
}

export async function getTimelineBackfillSummary({
  companyId,
}: {
  companyId: string;
}) {
  const dedupeReady = await hasDedupeKeyColumn();

  const [
    activityCount,
    attributedReplies,
    conversionsWithContacts,
    followUpsWithContacts,
    dedupedActivities,
  ] = await Promise.all([
    prisma.contactActivity.count({
      where: {
        companyId,
      },
    }),
    prisma.campaignReplyAttribution.count({
      where: {
        companyId,
      },
    }),
    prisma.campaignConversionEvent.count({
      where: {
        companyId,
        contactId: {
          not: null,
        },
      },
    }),
    prisma.campaignFollowUpTask.count({
      where: {
        companyId,
        contactId: {
          not: null,
        },
      },
    }),
    dedupeReady
      ? prisma.contactActivity.count({
          where: {
            companyId,
            dedupeKey: {
              not: null,
            },
          },
        })
      : Promise.resolve(0),
  ]);

  const sourceRecords =
    attributedReplies + conversionsWithContacts + followUpsWithContacts;

  return {
    activityCount,
    dedupedActivities,
    dedupeReady,
    sourceRecords,
    sources: {
      attributedReplies,
      conversionsWithContacts,
      followUpsWithContacts,
    },
  };
}

export async function runTimelineBackfill({
  actorUserId,
  companyId,
  take = 1000,
}: {
  actorUserId?: string | null;
  companyId: string;
  take?: number;
}) {
  const dedupeReady = await hasDedupeKeyColumn();

  if (!dedupeReady) {
    throw new Error("Timeline dedupe column is not migrated yet.");
  }

  const result = {
    attributions: emptyCounters(),
    conversions: emptyCounters(),
    followUps: emptyCounters(),
  };

  const attributions = await prisma.campaignReplyAttribution.findMany({
    where: {
      companyId,
    },
    orderBy: {
      replyReceivedAt: "asc",
    },
    take,
  });

  for (const attribution of attributions) {
    result.attributions.scanned += 1;

    if (!attribution.contactId) {
      result.attributions.skipped += 1;
      continue;
    }

    await recordContactActivity({
      companyId,
      contactId: attribution.contactId,
      createdAt: attribution.replyReceivedAt,
      dedupeKey: `campaign-reply-attribution:${attribution.id}`,
      metadata: {
        campaignId: attribution.campaignId,
        inboundMessageId: attribution.inboundMessageId ?? attribution.messageId,
        intent: attribution.intent,
        outboundMessageId: attribution.outboundMessageId,
        replyAttributionId: attribution.id,
        source: "timeline_backfill",
      },
      title: `Campaign reply attributed - ${attribution.intent}`,
      type: ContactActivityType.CAMPAIGN_REPLY_ATTRIBUTED,
    });

    result.attributions.createdOrUpdated += 1;
  }

  const conversions = await prisma.campaignConversionEvent.findMany({
    where: {
      companyId,
      contactId: {
        not: null,
      },
    },
    orderBy: {
      occurredAt: "asc",
    },
    take,
  });

  for (const conversion of conversions) {
    result.conversions.scanned += 1;

    if (!conversion.contactId) {
      result.conversions.skipped += 1;
      continue;
    }

    await recordContactActivity({
      actorUserId: conversion.createdByUserId ?? actorUserId ?? null,
      companyId,
      contactId: conversion.contactId,
      createdAt: conversion.occurredAt,
      dedupeKey: `campaign-conversion:${conversion.id}`,
      metadata: {
        campaignId: conversion.campaignId,
        conversionEventId: conversion.id,
        replyAttributionId: conversion.replyAttributionId,
        source: "timeline_backfill",
        type: conversion.type,
        valuePaise: conversion.valuePaise,
      },
      title: `Campaign conversion - ${conversion.type}`,
      type: ContactActivityType.CAMPAIGN_CONVERSION,
    });

    result.conversions.createdOrUpdated += 1;
  }

  const followUps = await prisma.campaignFollowUpTask.findMany({
    where: {
      companyId,
      contactId: {
        not: null,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    take,
  });

  for (const task of followUps) {
    result.followUps.scanned += 1;

    if (!task.contactId) {
      result.followUps.skipped += 1;
      continue;
    }

    await recordContactActivity({
      companyId,
      contactId: task.contactId,
      createdAt: task.createdAt,
      dedupeKey: `campaign-follow-up:${task.id}`,
      metadata: {
        campaignId: task.campaignId,
        priority: task.priority,
        replyAttributionId: task.replyAttributionId,
        source: "timeline_backfill",
        status: task.status,
        taskId: task.id,
      },
      title: "Campaign follow-up task created",
      description: preview(task.description),
      type: ContactActivityType.CAMPAIGN_FOLLOW_UP_CREATED,
    });

    result.followUps.createdOrUpdated += 1;
  }

  return {
    ok: true,
    result,
    summary: await getTimelineBackfillSummary({ companyId }),
  };
}

export async function getTimelineBackfillHealth() {
  const dedupeReady = await hasDedupeKeyColumn();

  const [dedupedActivities, campaignTimelineActivities] = await Promise.all([
    dedupeReady
      ? prisma.contactActivity.count({
          where: {
            dedupeKey: {
              not: null,
            },
          },
        })
      : Promise.resolve(0),
    prisma.contactActivity.count({
      where: {
        type: {
          in: [
            "CAMPAIGN_REPLY_ATTRIBUTED",
            "CAMPAIGN_CONVERSION",
            "CAMPAIGN_FOLLOW_UP_CREATED",
          ],
        },
      },
    }),
  ]);

  return {
    campaignTimelineActivities,
    dedupedActivities,
    dedupeReady,
    isHealthy: dedupeReady,
  };
}
