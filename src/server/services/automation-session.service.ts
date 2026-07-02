import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  safeJson,
  type AutomationContext,
} from "@/server/services/automation-context.service";

export const ACTIVE_AUTOMATION_SESSION_STATUSES = ["ACTIVE", "WAITING"] as const;

export async function findActiveAutomationSession({
  companyId,
  contactId,
}: {
  companyId: string;
  contactId: string;
}) {
  return prisma.automationSession.findFirst({
    where: {
      companyId,
      contactId,
      status: {
        in: [...ACTIVE_AUTOMATION_SESSION_STATUSES],
      },
    },
    include: {
      flow: true,
      flowVersion: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function startAutomationSession({
  companyId,
  contactId,
  context,
  currentNodeId,
  flowId,
  flowVersionId,
  inboundMessageId,
}: {
  companyId: string;
  contactId: string;
  context: AutomationContext;
  currentNodeId: string | null;
  flowId: string;
  flowVersionId: string;
  inboundMessageId: string;
}) {
  return prisma.automationSession.create({
    data: {
      companyId,
      contactId,
      context: safeJson(context),
      currentNodeId,
      flowId,
      flowVersionId,
      lastInboundMessageId: inboundMessageId,
      status: "ACTIVE",
    },
  });
}

export async function updateAutomationSessionContext({
  context,
  currentNodeId,
  sessionId,
}: {
  context: AutomationContext;
  currentNodeId?: string | null;
  sessionId: string;
}) {
  return prisma.automationSession.update({
    where: {
      id: sessionId,
    },
    data: {
      context: safeJson(context),
      ...(currentNodeId !== undefined ? { currentNodeId } : {}),
    },
  });
}

export async function markAutomationSessionWaiting({
  context,
  currentNodeId,
  replyTimeoutAt,
  sessionId,
  waitingNodeId,
}: {
  context: AutomationContext;
  currentNodeId: string;
  replyTimeoutAt?: Date | null;
  sessionId: string;
  waitingNodeId: string;
}) {
  return prisma.automationSession.update({
    where: {
      id: sessionId,
    },
    data: {
      context: safeJson(context),
      currentNodeId,
      replyTimeoutAt: replyTimeoutAt ?? null,
      status: "WAITING",
      waitingForReply: true,
      waitingNodeId,
    },
  });
}

export async function markAutomationSessionActive({
  context,
  inboundMessageId,
  sessionId,
}: {
  context: AutomationContext;
  inboundMessageId: string;
  sessionId: string;
}) {
  return prisma.automationSession.update({
    where: {
      id: sessionId,
    },
    data: {
      context: safeJson(context),
      lastInboundMessageId: inboundMessageId,
      replyTimeoutAt: null,
      status: "ACTIVE",
      waitingForReply: false,
      waitingNodeId: null,
    },
  });
}

export async function setAutomationSessionLastOutboundMessage({
  messageId,
  sessionId,
}: {
  messageId: string;
  sessionId: string;
}) {
  return prisma.automationSession.update({
    where: {
      id: sessionId,
    },
    data: {
      lastOutboundMessageId: messageId,
    },
  });
}

export async function completeAutomationSession(sessionId: string) {
  const completedAt = new Date();

  return prisma.automationSession.update({
    where: {
      id: sessionId,
    },
    data: {
      completedAt,
      endedAt: completedAt,
      status: "COMPLETED",
      waitingForReply: false,
      waitingNodeId: null,
    },
  });
}

export async function pauseAutomationSessionForHandoff(sessionId: string) {
  const handoffAt = new Date();

  return prisma.automationSession.update({
    where: {
      id: sessionId,
    },
    data: {
      handoffAt,
      pausedAt: handoffAt,
      status: "PAUSED",
      waitingForReply: false,
      waitingNodeId: null,
    },
  });
}

export async function failAutomationSession({
  error,
  sessionId,
}: {
  error?: unknown;
  sessionId: string;
}) {
  const failedAt = new Date();

  return prisma.automationSession.update({
    where: {
      id: sessionId,
    },
    data: {
      context: error
        ? ({
            error:
              error instanceof Error ? error.message : "Unknown automation error",
          } as Prisma.InputJsonValue)
        : undefined,
      endedAt: failedAt,
      failedAt,
      status: "FAILED",
      waitingForReply: false,
      waitingNodeId: null,
    },
  });
}

export async function expireAutomationSession(sessionId: string) {
  const endedAt = new Date();

  return prisma.automationSession.update({
    where: {
      id: sessionId,
    },
    data: {
      endedAt,
      status: "EXPIRED",
      waitingForReply: false,
      waitingNodeId: null,
    },
  });
}

export async function findExpiredWaitingAutomationSessions({
  limit = 100,
}: {
  limit?: number;
} = {}) {
  return prisma.automationSession.findMany({
    where: {
      replyTimeoutAt: {
        lt: new Date(),
      },
      status: "WAITING",
      waitingForReply: true,
    },
    include: {
      flow: true,
      flowVersion: true,
    },
    orderBy: {
      replyTimeoutAt: "asc",
    },
    take: limit,
  });
}
