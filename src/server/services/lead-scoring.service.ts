import { prisma } from "@/lib/prisma";
import { getLeadScoreQueue } from "@/lib/queue";
import { Prisma } from "@/generated/prisma/client";
import type { InboxPriority, LeadScoringConfig } from "@/generated/prisma/client";
import { calculateInboxSlaDueAt } from "@/server/services/inbox-sla.service";

const PRIORITY_RANK: Record<InboxPriority, number> = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  URGENT: 4,
};

export async function getLeadScoringConfig(companyId: string): Promise<LeadScoringConfig> {
  const config = await prisma.leadScoringConfig.findUnique({
    where: { companyId },
  });

  if (config) {
    return config;
  }

  return prisma.leadScoringConfig.create({
    data: {
      companyId,
    },
  });
}

export function scoreToInboxPriority(score: number, config: LeadScoringConfig): InboxPriority {
  if (score >= config.thresholdUrgent) return "URGENT";
  if (score >= config.thresholdHigh) return "HIGH";
  if (score >= config.thresholdNormal) return "NORMAL";
  return "LOW";
}

export function shouldElevatePriority(current: InboxPriority, next: InboxPriority): boolean {
  return PRIORITY_RANK[next] > PRIORITY_RANK[current];
}

export async function calculateLeadScore(companyId: string, contactId: string) {
  const config = await getLeadScoringConfig(companyId);

  if (!config.isEnabled) {
    return null;
  }

  const [
    contact,
    inboundCount,
    readMessageCount,
    replyAttributions,
    conversions,
  ] = await Promise.all([
    prisma.contact.findFirst({
      where: { id: contactId, companyId },
    }),
    prisma.message.count({
      where: {
        companyId,
        contactId,
        direction: "INBOUND",
      },
    }),
    prisma.message.count({
      where: {
        companyId,
        contactId,
        direction: "OUTBOUND",
        status: "READ",
      },
    }),
    prisma.campaignReplyAttribution.findMany({
      where: {
        companyId,
        contactId,
        status: {
          in: ["ATTRIBUTED", "MANUAL"],
        },
      },
      select: {
        intent: true,
      },
    }),
    prisma.campaignConversionEvent.findMany({
      where: {
        companyId,
        contactId,
      },
      select: {
        type: true,
      },
    }),
  ]);

  if (!contact) {
    throw new Error("Contact not found");
  }

  let score = 0;
  const breakdown: Record<string, number> = {};

  const inboundPoints = Math.min(inboundCount, 10) * config.pointsInboundMessage;
  breakdown.inbound_messages = inboundPoints;
  score += inboundPoints;

  const readPoints = Math.min(readMessageCount, 10) * config.pointsCampaignRead;
  breakdown.read_messages = readPoints;
  score += readPoints;

  for (const attr of replyAttributions) {
    if (attr.intent === "POSITIVE") {
      breakdown.positive_reply = (breakdown.positive_reply ?? 0) + config.pointsPositiveReply;
      score += config.pointsPositiveReply;
    }

    if (attr.intent === "NEGATIVE") {
      breakdown.negative_reply = (breakdown.negative_reply ?? 0) + config.pointsNegativeReply;
      score += config.pointsNegativeReply;
    }

    if (attr.intent === "QUESTION") {
      breakdown.question_reply = (breakdown.question_reply ?? 0) + config.pointsQuestionReply;
      score += config.pointsQuestionReply;
    }

    if (attr.intent === "OPT_OUT") {
      breakdown.opt_out = (breakdown.opt_out ?? 0) + config.pointsOptOut;
      score += config.pointsOptOut;
    }
  }

  for (const conversion of conversions) {
    if (conversion.type === "DEMO_BOOKED") {
      breakdown.demo_booked = (breakdown.demo_booked ?? 0) + config.pointsDemoBooked;
      score += config.pointsDemoBooked;
    }

    if (conversion.type === "PAYMENT_RECEIVED") {
      breakdown.payment_received = (breakdown.payment_received ?? 0) + config.pointsPaymentReceived;
      score += config.pointsPaymentReceived;
    }

    if (conversion.type === "LEAD_WON") {
      breakdown.lead_won = (breakdown.lead_won ?? 0) + config.pointsLeadWon;
      score += config.pointsLeadWon;
    }

    if (conversion.type === "LEAD_LOST") {
      breakdown.lead_lost = (breakdown.lead_lost ?? 0) + config.pointsLeadLost;
      score += config.pointsLeadLost;
    }
  }

  if (contact.inboxPriority === "HIGH") {
    breakdown.manual_high_priority = config.pointsHighPriority;
    score += config.pointsHighPriority;
  }

  if (contact.inboxPriority === "URGENT") {
    breakdown.manual_urgent_priority = config.pointsUrgentPriority;
    score += config.pointsUrgentPriority;
  }

  if (contact.isBlocked || contact.marketingConsentStatus === "REVOKED") {
    breakdown.blocked_or_opted_out = config.pointsOptOut;
    score += config.pointsOptOut;
  }

  const lastActivity = contact.lastRepliedAt ?? contact.lastSeenAt;

  if (lastActivity) {
    const daysSince = Math.floor((Date.now() - lastActivity.getTime()) / 86_400_000);

    if (daysSince > config.decayStartAfterDays) {
      const decayDays = daysSince - config.decayStartAfterDays;
      const decayPoints = decayDays * config.pointsDecayPerDay;
      breakdown.decay = decayPoints;
      score += decayPoints;
    }
  }

  score = Math.max(0, score);

  const leadScorePriority = scoreToInboxPriority(score, config);

  const data: Prisma.ContactUpdateInput = {
    leadScore: score,
    leadScoreUpdatedAt: new Date(),
    leadScoreBreakdown: breakdown,
    leadScorePriority,
  };

  if (shouldElevatePriority(contact.inboxPriority, leadScorePriority)) {
    data.inboxPriority = leadScorePriority;
    data.inboxSlaDueAt = calculateInboxSlaDueAt(leadScorePriority, new Date());
    data.inboxSlaBreachedAt = null;
  }

  await prisma.contact.update({
    where: { id: contact.id },
    data,
  });

  return {
    score,
    breakdown,
    leadScorePriority,
  };
}

export async function queueLeadScoreRecalculation(companyId: string, contactId: string) {
  await getLeadScoreQueue().add(
    "recalculate-lead-score",
    { companyId, contactId },
    {
      jobId: `lead-score:${companyId}:${contactId}`,
      delay: 10_000,
    },
  );
}

export async function queueDailyLeadScoreDecayBatch() {
  const oneDayAgo = new Date(Date.now() - 86_400_000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);

  const contacts = await prisma.contact.findMany({
    where: {
      leadScore: {
        gt: 0,
      },
      OR: [
        {
          leadScoreUpdatedAt: null,
        },
        {
          leadScoreUpdatedAt: {
            lt: oneDayAgo,
          },
        },
      ],
      lastRepliedAt: {
        lt: sevenDaysAgo,
      },
    },
    select: {
      id: true,
      companyId: true,
    },
    take: 5000,
  });

  for (const contact of contacts) {
    await queueLeadScoreRecalculation(contact.companyId, contact.id);
  }

  return contacts.length;
}
