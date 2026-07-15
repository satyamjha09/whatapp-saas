import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createCompanyNotification } from "@/server/services/company-notification.service";
import { createQueuedInboxReply } from "@/server/services/message.service";
import type { InboxCsatSettingsInput } from "@/server/validators/inbox-csat.validator";

const ACTIVE_CSAT_STATUSES = ["PENDING", "SENT"] as const;
const DEFAULT_CSAT_MESSAGE =
  "Thanks for chatting with us. Please reply with a number from 1 to 5 to rate your support experience.";

type CsatDispatchResult =
  | { dispatched: true; messageId: string; surveyId: string }
  | { dispatched: false; reason: string; surveyId: string };

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function extractCsatScore(body: string) {
  const match = body.trim().match(/^([1-5])(?:\D|$)/);
  if (!match) return null;
  return Number(match[1]);
}

function compactError(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : "Unknown CSAT error";
}

export async function getInboxCsatSettings(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      inboxCsatDelayMinutes: true,
      inboxCsatEnabled: true,
      inboxCsatExpirationHours: true,
      inboxCsatFollowUpQuestion: true,
      inboxCsatLowScoreThreshold: true,
      inboxCsatSurveyMessage: true,
    },
  });

  if (!company) throw new Error("Company not found");

  return {
    enabled: company.inboxCsatEnabled,
    delayMinutes: company.inboxCsatDelayMinutes,
    expirationHours: company.inboxCsatExpirationHours,
    followUpQuestion: company.inboxCsatFollowUpQuestion ?? "",
    lowScoreThreshold: company.inboxCsatLowScoreThreshold,
    surveyMessage: company.inboxCsatSurveyMessage || DEFAULT_CSAT_MESSAGE,
  };
}

export async function updateInboxCsatSettings(
  companyId: string,
  input: InboxCsatSettingsInput,
) {
  return prisma.company.update({
    where: { id: companyId },
    data: {
      inboxCsatDelayMinutes: input.delayMinutes,
      inboxCsatEnabled: input.enabled,
      inboxCsatExpirationHours: input.expirationHours,
      inboxCsatFollowUpQuestion: input.followUpQuestion,
      inboxCsatLowScoreThreshold: input.lowScoreThreshold,
      inboxCsatSurveyMessage: input.surveyMessage,
    },
    select: {
      inboxCsatDelayMinutes: true,
      inboxCsatEnabled: true,
      inboxCsatExpirationHours: true,
      inboxCsatFollowUpQuestion: true,
      inboxCsatLowScoreThreshold: true,
      inboxCsatSurveyMessage: true,
    },
  });
}

export async function hasActiveInboxCsatSurvey({
  companyId,
  contactId,
}: {
  companyId: string;
  contactId: string;
}) {
  const now = new Date();
  const count = await prisma.inboxCsatSurvey.count({
    where: {
      companyId,
      contactId,
      score: null,
      status: {
        in: [...ACTIVE_CSAT_STATUSES],
      },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });

  return count > 0;
}

async function dispatchInboxCsatSurvey(surveyId: string): Promise<CsatDispatchResult> {
  const survey = await prisma.inboxCsatSurvey.findUnique({
    where: { id: surveyId },
    include: {
      company: {
        select: {
          inboxCsatDelayMinutes: true,
          inboxCsatSurveyMessage: true,
        },
      },
      contact: {
        select: {
          id: true,
          isBlocked: true,
          optedOutAt: true,
        },
      },
    },
  });

  if (!survey) {
    return { dispatched: false, reason: "Survey not found", surveyId };
  }

  if (!ACTIVE_CSAT_STATUSES.includes(survey.status as (typeof ACTIVE_CSAT_STATUSES)[number])) {
    return { dispatched: false, reason: `Survey is ${survey.status}`, surveyId };
  }

  if (survey.sentMessageId) {
    return { dispatched: false, reason: "Survey already sent", surveyId };
  }

  const now = new Date();
  const dueAt = addMinutes(survey.createdAt, survey.company.inboxCsatDelayMinutes);

  if (dueAt > now) {
    return { dispatched: false, reason: "Survey is not due yet", surveyId };
  }

  if (survey.expiresAt && survey.expiresAt <= now) {
    await prisma.inboxCsatSurvey.update({
      where: { id: survey.id },
      data: { status: "EXPIRED" },
    });
    return { dispatched: false, reason: "Survey expired before send", surveyId };
  }

  if (survey.contact.isBlocked || survey.contact.optedOutAt) {
    await prisma.inboxCsatSurvey.update({
      where: { id: survey.id },
      data: { status: "CANCELLED" },
    });
    return { dispatched: false, reason: "Contact is opted out or blocked", surveyId };
  }

  try {
    const message = await createQueuedInboxReply(
      survey.companyId,
      survey.contactId,
      {
        body: survey.company.inboxCsatSurveyMessage || DEFAULT_CSAT_MESSAGE,
      },
      {
        actorUserId: null,
      },
    );

    await prisma.inboxCsatSurvey.update({
      where: { id: survey.id },
      data: {
        sentAt: new Date(),
        sentMessageId: message.id,
        status: "SENT",
      },
    });

    return { dispatched: true, messageId: message.id, surveyId };
  } catch (error) {
    await prisma.inboxCsatSurvey.update({
      where: { id: survey.id },
      data: {
        status: "FAILED",
        comment: `Send failed: ${compactError(error)}`,
      },
    });

    return { dispatched: false, reason: compactError(error), surveyId };
  }
}

export async function createInboxCsatSurveyForClosedConversation({
  closedByUserId,
  companyId,
  contactId,
}: {
  closedByUserId?: string | null;
  companyId: string;
  contactId: string;
}) {
  const contact = await prisma.contact.findFirst({
    where: {
      companyId,
      id: contactId,
    },
    include: {
      company: {
        select: {
          inboxCsatDelayMinutes: true,
          inboxCsatEnabled: true,
          inboxCsatExpirationHours: true,
        },
      },
    },
  });

  if (!contact) throw new Error("Contact not found");
  if (!contact.company.inboxCsatEnabled) {
    return { created: false, reason: "CSAT disabled", survey: null };
  }

  if (contact.isBlocked || contact.optedOutAt) {
    return { created: false, reason: "Contact opted out or blocked", survey: null };
  }

  const closedAt = contact.inboxClosedAt ?? contact.inboxResolvedAt ?? new Date();
  const closeCycleKey = `closed:${closedAt.toISOString()}`;
  const expiresAt = addHours(
    addMinutes(closedAt, contact.company.inboxCsatDelayMinutes),
    contact.company.inboxCsatExpirationHours,
  );

  const survey = await prisma.inboxCsatSurvey.upsert({
    where: {
      companyId_contactId_closeCycleKey: {
        companyId,
        contactId: contact.id,
        closeCycleKey,
      },
    },
    update: {},
    create: {
      assignedToUserId: contact.assignedToUserId,
      closeCycleKey,
      closedByUserId: closedByUserId ?? null,
      companyId,
      contactId: contact.id,
      expiresAt,
      queueId: contact.inboxQueueId,
      status: "PENDING",
    },
  });

  if (contact.company.inboxCsatDelayMinutes === 0) {
    await dispatchInboxCsatSurvey(survey.id);
  }

  return { created: true, reason: null, survey };
}

export async function dispatchPendingInboxCsatSurveys({ limit = 100 } = {}) {
  const now = new Date();
  const surveys = await prisma.inboxCsatSurvey.findMany({
    where: {
      score: null,
      status: {
        in: ["PENDING"],
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    take: limit,
  });

  const results: CsatDispatchResult[] = [];

  for (const survey of surveys) {
    if (survey.expiresAt && survey.expiresAt <= now) {
      await prisma.inboxCsatSurvey.update({
        where: { id: survey.id },
        data: { status: "EXPIRED" },
      });
      results.push({
        dispatched: false,
        reason: "Survey expired",
        surveyId: survey.id,
      });
      continue;
    }

    results.push(await dispatchInboxCsatSurvey(survey.id));
  }

  return {
    checked: surveys.length,
    dispatched: results.filter((result) => result.dispatched).length,
    results,
  };
}

async function notifyLowCsatScore({
  companyId,
  contactName,
  contactId,
  score,
  surveyId,
}: {
  companyId: string;
  contactId: string;
  contactName: string | null;
  score: number;
  surveyId: string;
}) {
  await createCompanyNotification({
    companyId,
    type: "INBOX",
    severity: score <= 1 ? "ERROR" : "WARNING",
    title: "Low support rating received",
    message: `${contactName ?? "A customer"} rated the support conversation ${score}/5. Review the conversation and follow up quickly.`,
    actionHref: `/dashboard/inbox?contactId=${contactId}`,
    idempotencyKey: `inbox-csat-low-score:${surveyId}`,
    metadata: {
      contactId,
      score,
      surveyId,
    } satisfies Prisma.InputJsonValue,
  });
}

export async function recordCsatResponseFromInboundMessage({
  body,
  companyId,
  contactId,
  inboundMessageId,
}: {
  body: string;
  companyId: string;
  contactId: string;
  inboundMessageId?: string | null;
}) {
  const score = extractCsatScore(body);
  if (!score) return { handled: false, reason: "No CSAT score" };

  const now = new Date();
  const survey = await prisma.inboxCsatSurvey.findFirst({
    where: {
      companyId,
      contactId,
      score: null,
      status: {
        in: [...ACTIVE_CSAT_STATUSES],
      },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    include: {
      company: {
        select: {
          inboxCsatLowScoreThreshold: true,
        },
      },
      contact: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!survey) return { handled: false, reason: "No active survey" };

  const updated = await prisma.inboxCsatSurvey.updateMany({
    where: {
      id: survey.id,
      score: null,
    },
    data: {
      comment: body.trim(),
      respondedAt: now,
      score,
      status: "RESPONDED",
    },
  });

  if (updated.count === 0) {
    return { handled: true, reason: "Survey already recorded", surveyId: survey.id };
  }

  if (score <= survey.company.inboxCsatLowScoreThreshold) {
    await notifyLowCsatScore({
      companyId,
      contactId,
      contactName: survey.contact.name,
      score,
      surveyId: survey.id,
    });
  }

  await prisma.messageEvent.create({
    data: {
      companyId,
      messageId: inboundMessageId ?? survey.sentMessageId ?? "",
      status: "RECEIVED",
      raw: {
        source: "inbox_csat",
        score,
        surveyId: survey.id,
      },
    },
  }).catch(() => undefined);

  return { handled: true, score, surveyId: survey.id };
}
