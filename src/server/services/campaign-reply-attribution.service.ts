import { CampaignReplyIntent, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit.service";
import { queueLeadScoreRecalculation } from "@/server/services/lead-scoring.service";
import { recordContactActivity } from "@/server/services/contact-activity.service";
import { revokeMarketingConsent } from "@/server/services/contact-consent.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";

export class CampaignReplyAttributionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CampaignReplyAttributionError";
  }
}

function isEnabled() {
  return process.env.CAMPAIGN_REPLY_ATTRIBUTION_ENABLED !== "false";
}

function autoClassifyEnabled() {
  return process.env.CAMPAIGN_REPLY_AUTO_CLASSIFY_ENABLED !== "false";
}

function autoOptOutEnabled() {
  return process.env.CAMPAIGN_REPLY_AUTO_OPT_OUT_ENABLED !== "false";
}

function autoFollowUpEnabled() {
  return process.env.CAMPAIGN_REPLY_AUTO_CREATE_FOLLOW_UP_ENABLED !== "false";
}

function conversionTrackingEnabled() {
  return process.env.CAMPAIGN_CONVERSION_TRACKING_ENABLED !== "false";
}

function attributionWindowDays() {
  const value = Number(process.env.CAMPAIGN_REPLY_ATTRIBUTION_WINDOW_DAYS ?? 14);
  return Number.isFinite(value) && value > 0 ? value : 14;
}

function splitKeywords(value?: string) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function positiveKeywords() {
  return splitKeywords(
    process.env.CAMPAIGN_REPLY_POSITIVE_KEYWORDS ??
      "interested,yes,ok,okay,call,demo,price,details,send,share",
  );
}

function negativeKeywords() {
  return splitKeywords(
    process.env.CAMPAIGN_REPLY_NEGATIVE_KEYWORDS ??
      "no,not interested,later,stop,don't send",
  );
}

function optOutKeywords() {
  return splitKeywords(
    process.env.CAMPAIGN_REPLY_OPT_OUT_KEYWORDS ??
      "stop,unsubscribe,opt out,remove,don't message,do not message",
  );
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(redactSensitiveData(value))) as Prisma.InputJsonValue;
}

function previewText(value?: string | null) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 180);
}

function classifyReplyIntent(body?: string | null): CampaignReplyIntent {
  if (!autoClassifyEnabled()) return "UNKNOWN";

  const text = String(body ?? "").toLowerCase().trim();

  if (!text) return "UNKNOWN";

  if (optOutKeywords().some((keyword) => text.includes(keyword))) {
    return "OPT_OUT";
  }

  if (text.includes("?")) {
    return "QUESTION";
  }

  if (positiveKeywords().some((keyword) => text.includes(keyword))) {
    return "POSITIVE";
  }

  if (negativeKeywords().some((keyword) => text.includes(keyword))) {
    return "NEGATIVE";
  }

  return "NEUTRAL";
}

function shouldCreateFollowUp(intent: CampaignReplyIntent) {
  return ["POSITIVE", "QUESTION", "NEUTRAL"].includes(intent);
}

function followUpPriority(intent: CampaignReplyIntent) {
  if (intent === "POSITIVE" || intent === "QUESTION") return "HIGH";
  return "MEDIUM";
}

async function applyOptOutIfNeeded({
  companyId,
  contactId,
  intent,
  replyBody,
}: {
  companyId: string;
  contactId?: string | null;
  intent: CampaignReplyIntent;
  replyBody?: string | null;
}) {
  if (!autoOptOutEnabled() || !contactId || intent !== "OPT_OUT") return false;

  const now = new Date();

  await prisma.contact.updateMany({
    where: {
      companyId,
      id: contactId,
    },
    data: {
      isBlocked: true,
      blockedAt: now,
      optedOutAt: now,
      optOutReason: `Campaign reply: ${previewText(replyBody)}`,
      optOutSource: "CAMPAIGN_REPLY",
    },
  });

  await revokeMarketingConsent({
    companyId,
    contactId,
    evidenceText: replyBody ?? "Campaign reply opt-out",
    metadata: {
      source: "campaign_reply_attribution",
    },
    source: "CAMPAIGN_REPLY",
  }).catch(() => undefined);

  return true;
}

async function createConversionEvent({
  campaignId,
  companyId,
  contactId,
  messageId,
  note,
  replyAttributionId,
  type,
}: {
  campaignId: string;
  companyId: string;
  contactId?: string | null;
  messageId?: string | null;
  note?: string | null;
  replyAttributionId?: string | null;
  type: "REPLY_RECEIVED" | "POSITIVE_REPLY" | "OPT_OUT";
}) {
  if (!conversionTrackingEnabled()) return null;

  if (replyAttributionId) {
    const existing = await prisma.campaignConversionEvent.findFirst({
      where: {
        companyId,
        replyAttributionId,
        type,
      },
    });

    if (existing) return existing;
  }

  const event = await prisma.campaignConversionEvent.create({
    data: {
      campaignId,
      companyId,
      contactId: contactId ?? null,
      messageId: messageId ?? null,
      metadata: safeJson({
        source: "campaign_reply_attribution",
      }),
      note: note ?? null,
      replyAttributionId: replyAttributionId ?? null,
      type,
    },
  });

  if (contactId) {
    await queueLeadScoreRecalculation(companyId, contactId).catch(() => undefined);
  }

  return event;
}

async function createFollowUpTaskIfNeeded({
  campaignId,
  companyId,
  contactId,
  intent,
  replyAttributionId,
  replyBody,
}: {
  campaignId: string;
  companyId: string;
  contactId?: string | null;
  intent: CampaignReplyIntent;
  replyAttributionId: string;
  replyBody?: string | null;
}) {
  if (!autoFollowUpEnabled() || !shouldCreateFollowUp(intent)) return null;

  const existing = await prisma.campaignFollowUpTask.findFirst({
    where: {
      campaignId,
      companyId,
      replyAttributionId,
      status: "OPEN",
    },
  });

  if (existing) return existing;

  const task = await prisma.campaignFollowUpTask.create({
    data: {
      campaignId,
      companyId,
      contactId: contactId ?? null,
      description: previewText(replyBody),
      dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      metadata: safeJson({ intent }),
      priority: followUpPriority(intent),
      replyAttributionId,
      status: "OPEN",
      title:
        intent === "POSITIVE"
          ? "Hot campaign reply"
          : intent === "QUESTION"
            ? "Customer asked a question"
            : "Campaign reply needs follow-up",
    },
  });

  if (contactId) {
    await recordContactActivity({
      companyId,
      contactId,
      dedupeKey: `campaign-follow-up:${task.id}`,
      metadata: {
        campaignId,
        intent,
        replyAttributionId,
        taskId: task.id,
      },
      title: "Campaign follow-up task created",
      type: "CAMPAIGN_FOLLOW_UP_CREATED",
    }).catch(() => undefined);
  }

  return task;
}

export async function attributeInboundCampaignReply({
  companyId,
  inboundMessageId,
}: {
  companyId: string;
  inboundMessageId: string;
}) {
  if (!isEnabled()) {
    throw new CampaignReplyAttributionError("Campaign Reply Attribution is disabled.");
  }

  const inbound = await prisma.message.findFirst({
    where: {
      companyId,
      direction: "INBOUND",
      id: inboundMessageId,
    },
    select: {
      body: true,
      companyId: true,
      contactId: true,
      createdAt: true,
      id: true,
    },
  });

  if (!inbound) {
    throw new CampaignReplyAttributionError("Inbound message not found.");
  }

  const cutoff = new Date(
    inbound.createdAt.getTime() - attributionWindowDays() * 24 * 60 * 60 * 1000,
  );
  const outbound = await prisma.message.findFirst({
    where: {
      campaignId: {
        not: null,
      },
      companyId,
      contactId: inbound.contactId,
      createdAt: {
        gte: cutoff,
        lte: inbound.createdAt,
      },
      direction: "OUTBOUND",
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      campaignId: true,
      createdAt: true,
      id: true,
    },
  });

  if (!outbound?.campaignId) return null;

  const intent = classifyReplyIntent(inbound.body);
  const responseTimeMinutes = Math.max(
    0,
    Math.round((inbound.createdAt.getTime() - outbound.createdAt.getTime()) / 60_000),
  );
  const autoOptOutApplied = await applyOptOutIfNeeded({
    companyId,
    contactId: inbound.contactId,
    intent,
    replyBody: inbound.body,
  });

  const attribution = await prisma.campaignReplyAttribution.upsert({
    where: {
      campaignId_messageId: {
        campaignId: outbound.campaignId,
        messageId: inbound.id,
      },
    },
    create: {
      attributedAt: new Date(),
      autoClassified: autoClassifyEnabled(),
      autoOptOutApplied,
      campaignId: outbound.campaignId,
      companyId,
      contactId: inbound.contactId,
      inboundMessageId: inbound.id,
      intent,
      messageId: inbound.id,
      metadata: safeJson({
        attributionWindowDays: attributionWindowDays(),
      }),
      outboundMessageId: outbound.id,
      repliedAt: inbound.createdAt,
      replyBody: inbound.body ?? null,
      replyBodyPreview: previewText(inbound.body),
      replyReceivedAt: inbound.createdAt,
      responseTimeMinutes,
      source: "AUTO",
      status: "ATTRIBUTED",
    },
    update: {
      autoClassified: autoClassifyEnabled(),
      autoOptOutApplied,
      contactId: inbound.contactId,
      inboundMessageId: inbound.id,
      intent,
      metadata: safeJson({
        attributionWindowDays: attributionWindowDays(),
      }),
      outboundMessageId: outbound.id,
      repliedAt: inbound.createdAt,
      replyBody: inbound.body ?? null,
      replyBodyPreview: previewText(inbound.body),
      replyReceivedAt: inbound.createdAt,
      responseTimeMinutes,
      status: "ATTRIBUTED",
    },
  });

  await createConversionEvent({
    campaignId: outbound.campaignId,
    companyId,
    contactId: inbound.contactId,
    messageId: inbound.id,
    note: "Campaign reply received.",
    replyAttributionId: attribution.id,
    type: "REPLY_RECEIVED",
  });

  if (intent === "POSITIVE") {
    await createConversionEvent({
      campaignId: outbound.campaignId,
      companyId,
      contactId: inbound.contactId,
      messageId: inbound.id,
      note: "Positive campaign reply detected.",
      replyAttributionId: attribution.id,
      type: "POSITIVE_REPLY",
    });
  }

  if (intent === "OPT_OUT") {
    await createConversionEvent({
      campaignId: outbound.campaignId,
      companyId,
      contactId: inbound.contactId,
      messageId: inbound.id,
      note: "Opt-out reply detected.",
      replyAttributionId: attribution.id,
      type: "OPT_OUT",
    });
  }

  await createFollowUpTaskIfNeeded({
    campaignId: outbound.campaignId,
    companyId,
    contactId: inbound.contactId,
    intent,
    replyAttributionId: attribution.id,
    replyBody: inbound.body,
  });

  await recordContactActivity({
    companyId,
    contactId: inbound.contactId,
    dedupeKey: `campaign-reply-attribution:${attribution.id}`,
    metadata: {
      autoOptOutApplied,
      campaignId: outbound.campaignId,
      inboundMessageId: inbound.id,
      intent,
      outboundMessageId: outbound.id,
      replyAttributionId: attribution.id,
    },
    title: `Campaign reply attributed - ${intent}`,
    type: "CAMPAIGN_REPLY_ATTRIBUTED",
  }).catch(() => undefined);

  await createAuditLog({
    action: "campaign.reply_attributed",
    companyId,
    entityId: attribution.id,
    entityType: "CampaignReplyAttribution",
    metadata: safeJson({
      autoOptOutApplied,
      campaignId: outbound.campaignId,
      contactId: inbound.contactId,
      inboundMessageId: inbound.id,
      intent,
      outboundMessageId: outbound.id,
    }),
  }).catch(() => undefined);

  await queueLeadScoreRecalculation(companyId, inbound.contactId).catch(() => undefined);

  return attribution;
}

export async function createManualCampaignConversion({
  actorUserId,
  campaignId,
  companyId,
  contactId,
  note,
  type,
  valuePaise,
}: {
  actorUserId?: string | null;
  campaignId: string;
  companyId: string;
  contactId?: string | null;
  note?: string | null;
  type:
    | "DEMO_BOOKED"
    | "MEETING_DONE"
    | "PAYMENT_RECEIVED"
    | "LEAD_WON"
    | "LEAD_LOST";
  valuePaise?: number | null;
}) {
  if (!conversionTrackingEnabled()) {
    throw new CampaignReplyAttributionError("Campaign conversion tracking is disabled.");
  }

  const event = await prisma.campaignConversionEvent.create({
    data: {
      campaignId,
      companyId,
      contactId: contactId ?? null,
      createdByUserId: actorUserId ?? null,
      metadata: safeJson({
        source: "manual",
      }),
      note: note ?? null,
      type,
      valuePaise: valuePaise ?? null,
    },
  });

  if (contactId) {
    await recordContactActivity({
      actorUserId,
      companyId,
      contactId,
      dedupeKey: `campaign-conversion:${event.id}`,
      metadata: {
        campaignId,
        conversionEventId: event.id,
        type,
        valuePaise,
      },
      title: `Campaign conversion - ${type}`,
      type: "CAMPAIGN_CONVERSION",
    }).catch(() => undefined);
  }

  await createAuditLog({
    action: "campaign.conversion_event_created",
    actorUserId: actorUserId ?? undefined,
    companyId,
    entityId: event.id,
    entityType: "CampaignConversionEvent",
    metadata: safeJson({
      campaignId,
      contactId,
      type,
      valuePaise,
    }),
  }).catch(() => undefined);

  if (contactId) {
    await queueLeadScoreRecalculation(companyId, contactId).catch(() => undefined);
  }

  return event;
}

export async function updateCampaignFollowUpTask({
  actorUserId,
  companyId,
  ignoreReason,
  status,
  taskId,
}: {
  actorUserId?: string | null;
  companyId: string;
  ignoreReason?: string | null;
  status: "COMPLETED" | "IGNORED";
  taskId: string;
}) {
  const task = await prisma.campaignFollowUpTask.findFirst({
    where: {
      companyId,
      id: taskId,
    },
  });

  if (!task) {
    throw new CampaignReplyAttributionError("Follow-up task not found.");
  }

  const updated = await prisma.campaignFollowUpTask.update({
    where: { id: task.id },
    data:
      status === "COMPLETED"
        ? {
            completedAt: new Date(),
            completedByUserId: actorUserId ?? null,
            status,
          }
        : {
            ignoredAt: new Date(),
            ignoredByUserId: actorUserId ?? null,
            ignoreReason: ignoreReason?.trim() || null,
            status,
          },
  });

  await createAuditLog({
    action: "campaign.follow_up_task_updated",
    actorUserId: actorUserId ?? undefined,
    companyId,
    entityId: task.id,
    entityType: "CampaignFollowUpTask",
    metadata: safeJson({
      ignoreReason,
      nextStatus: status,
      previousStatus: task.status,
    }),
  }).catch(() => undefined);

  return updated;
}

export async function getCampaignReplyAttributionDashboard({
  campaignId,
  companyId,
}: {
  campaignId?: string | null;
  companyId: string;
}) {
  const where = {
    companyId,
    ...(campaignId ? { campaignId } : {}),
  };

  const [attributions, conversions, tasks] = await Promise.all([
    prisma.campaignReplyAttribution.findMany({
      where,
      orderBy: {
        replyReceivedAt: "desc",
      },
      take: 200,
    }),
    prisma.campaignConversionEvent.findMany({
      where,
      include: {
        createdByUser: {
          select: {
            email: true,
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        occurredAt: "desc",
      },
      take: 200,
    }),
    prisma.campaignFollowUpTask.findMany({
      where,
      include: {
        assignedToUser: {
          select: {
            email: true,
            id: true,
            name: true,
          },
        },
        completedByUser: {
          select: {
            email: true,
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { status: "asc" },
        { priority: "desc" },
        { createdAt: "desc" },
      ],
      take: 200,
    }),
  ]);

  const intentCounts = attributions.reduce<Record<string, number>>((acc, item) => {
    acc[item.intent] = (acc[item.intent] ?? 0) + 1;
    return acc;
  }, {});
  const conversionCounts = conversions.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] ?? 0) + 1;
    return acc;
  }, {});

  return {
    attributions,
    conversionCounts,
    conversions,
    intentCounts,
    tasks,
  };
}

export async function getCampaignReplyAttributionHealth() {
  const since24h = new Date(Date.now() - 86_400_000);

  const [attributed24h, positive24h, optOut24h, openTasks] = await Promise.all([
    prisma.campaignReplyAttribution.count({
      where: {
        createdAt: {
          gte: since24h,
        },
      },
    }),
    prisma.campaignReplyAttribution.count({
      where: {
        createdAt: {
          gte: since24h,
        },
        intent: "POSITIVE",
      },
    }),
    prisma.campaignReplyAttribution.count({
      where: {
        createdAt: {
          gte: since24h,
        },
        intent: "OPT_OUT",
      },
    }),
    prisma.campaignFollowUpTask.count({
      where: {
        status: "OPEN",
      },
    }),
  ]);

  return {
    attributed24h,
    enabled: isEnabled(),
    isHealthy: isEnabled(),
    openTasks,
    optOut24h,
    positive24h,
  };
}
