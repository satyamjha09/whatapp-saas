import {
  InboxAssignmentMode,
  InboxAssignmentSource,
  Prisma,
} from "@/generated/prisma/client";
import { MESSAGE_PRICE_PAISE } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import { getMessageQueue } from "@/lib/queue";
import { assertCompanyMessageQuota } from "@/server/services/message-quota.service";
import { assertSubscriptionCanSend } from "@/server/services/subscription-expiry.service";
import { recordContactActivity } from "@/server/services/contact-activity.service";
import { assignConversationToBestAgent } from "@/server/services/inbox-assignment.service";
import { routeConversation } from "@/server/services/inbox-routing.service";
import {
  assertUsageQuotaAvailable,
  incrementUsageQuota,
} from "@/server/services/usage-quota.service";
import type { StartChatbotWhatsAppTestInput } from "@/server/validators/chatbot.validator";

const ACTIVE_SESSION_STATUSES = ["ACTIVE", "WAITING_FOR_REPLY"] as const;
const MAX_RUNTIME_STEPS = 20;

export type ChatbotInboundOutcome = {
  handled: boolean;
  handedOff: boolean;
  handoffReason?: string;
  requestedQueueId?: string;
  sessionId?: string;
};

type TemplateTriggerContext = {
  language: string | null;
  messageId: string;
  metaTemplateId: string | null;
  templateId: string;
  templateName: string;
};

function safeJson(value: unknown): Prisma.InputJsonValue {
  return (value ?? Prisma.JsonNull) as Prisma.InputJsonValue;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizedText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function optionalAssignmentMode(value: unknown) {
  return typeof value === "string" &&
    Object.values(InboxAssignmentMode).includes(value as InboxAssignmentMode)
    ? (value as InboxAssignmentMode)
    : undefined;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function normalizePhoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

function words(value: string) {
  return normalizedText(value)
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
}

function getInboundReplyText(message: {
  body: string;
  metadata: Prisma.JsonValue | null;
}) {
  const metadata = asRecord(message.metadata);

  if (metadata.messageType === "BUTTON") {
    return String(metadata.text ?? metadata.payload ?? message.body).trim();
  }

  if (metadata.messageType === "INTERACTIVE") {
    const interactive = asRecord(metadata.interactive);
    const buttonReply = asRecord(interactive.button_reply);
    const listReply = asRecord(interactive.list_reply);

    return String(
      buttonReply.title ??
        buttonReply.id ??
        listReply.title ??
        listReply.id ??
        message.body,
    ).trim();
  }

  return message.body.trim();
}

function getContext(
  record: Prisma.JsonValue | null | undefined,
): Record<string, unknown> {
  const context = asRecord(record);
  const answers = asRecord(context.answers);

  return {
    ...context,
    answers,
  };
}

function getConfig(record: Prisma.JsonValue | null | undefined) {
  return asRecord(record);
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function buttonValues(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").slice(0, 3)
    : [];
}

function listSections(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (section): section is Record<string, unknown> =>
        Boolean(section) &&
        typeof section === "object" &&
        !Array.isArray(section),
    )
    .map((section) => ({
      title: textValue(section.title, "Options"),
      rows: Array.isArray(section.rows)
        ? section.rows
            .filter(
              (row): row is Record<string, unknown> =>
                Boolean(row) &&
                typeof row === "object" &&
                !Array.isArray(row),
            )
            .map((row) => ({
              description: textValue(row.description),
              title: textValue(row.title),
            }))
            .filter((row) => row.title)
        : [],
    }))
    .filter((section) => section.rows.length > 0)
    .slice(0, 10);
}

function nodeChoiceValues(type: string, config: Record<string, unknown>) {
  if (type === "QUICK_REPLY" || type === "MEDIA_BUTTONS") {
    return buttonValues(config.buttons);
  }

  if (type === "LIST_MENU") {
    return listSections(config.sections).flatMap((section) =>
      section.rows.map((row) => row.title),
    );
  }

  return [];
}

function fieldValue(context: Record<string, unknown>, field: string) {
  if (field === "last_reply") {
    return String(context.last_reply ?? "");
  }

  const answers = asRecord(context.answers);
  return String(answers[field] ?? "");
}

function evaluateCondition(config: Record<string, unknown>, context: Record<string, unknown>) {
  const field = textValue(config.field, "last_reply");
  const operator = textValue(config.operator, "equals");
  const expected = normalizedText(textValue(config.value));
  const actual = normalizedText(fieldValue(context, field));

  if (operator === "contains") return actual.includes(expected);
  if (operator === "exists") return Boolean(actual);
  if (operator === "not_equals") return actual !== expected;
  return actual === expected;
}

function matchesTrigger({
  body,
  templateContext,
  trigger,
}: {
  body: string;
  templateContext?: TemplateTriggerContext | null;
  trigger: {
    type: string;
    value: string | null;
  };
}) {
  const value = normalizedText(trigger.value);
  const normalizedBody = normalizedText(body);

  if (trigger.type === "DEFAULT_WELCOME") return true;
  if (!value) return false;

  if (trigger.type === "KEYWORD") {
    return normalizedBody === value || words(normalizedBody).includes(value);
  }

  if (trigger.type === "CLICK_TO_WHATSAPP_AD") {
    return normalizedBody === value || normalizedBody.includes(value);
  }

  if (trigger.type === "TEMPLATE_MESSAGE") {
    if (!templateContext) return false;

    const candidates = [
      templateContext.templateId,
      templateContext.templateName,
      templateContext.metaTemplateId,
      templateContext.language
        ? `${templateContext.templateName}:${templateContext.language}`
        : null,
    ]
      .filter((candidate): candidate is string => Boolean(candidate))
      .map((candidate) => normalizedText(candidate));

    return candidates.includes(value);
  }

  if (trigger.type === "REGEX") {
    try {
      return new RegExp(trigger.value ?? "", "i").test(body);
    } catch {
      return false;
    }
  }

  return false;
}

function pickEdgeForReply<
  TEdge extends {
    label: string | null;
    sourceNodeId: string;
    targetNodeId: string;
  },
>(edges: TEdge[], replyText: string) {
  const reply = normalizedText(replyText);

  return (
    edges.find((edge) => {
      const label = normalizedText(edge.label);
      return label && (label === reply || label.includes(reply) || reply.includes(label));
    }) ?? edges[0]
  );
}

function findChoiceEdge<
  TEdge extends {
    label: string | null;
    sourceNodeId: string;
    targetNodeId: string;
  },
>(edges: TEdge[], replyText: string, choices: string[]) {
  const reply = normalizedText(replyText);

  return (
    edges.find((edge) => {
      const label = normalizedText(edge.label);
      return label && label === reply;
    }) ??
    edges.find((edge) => {
      const label = normalizedText(edge.label);
      const matchedChoice = choices.some((choice) => normalizedText(choice) === reply);
      return matchedChoice && label && choices.some((choice) => normalizedText(choice) === label);
    }) ??
    null
  );
}

function fallbackMessageFor(
  chatbotMetadata: Prisma.JsonValue | null,
  nodeConfig: Record<string, unknown>,
) {
  return (
    textValue(nodeConfig.fallbackMessage) ||
    textValue(asRecord(chatbotMetadata).fallbackMessage) ||
    "Please choose one of the available options."
  );
}

function renderTemplateString(
  template: string | null | undefined,
  context: Record<string, unknown>,
) {
  if (!template) return "";

  return template.replace(/{{\s*([a-zA-Z0-9_.]+)\s*}}/g, (_, key: string) => {
    if (key === "answers") {
      return JSON.stringify(asRecord(context.answers));
    }

    const answers = asRecord(context.answers);
    const direct = context[key] ?? answers[key];

    if (direct === undefined || direct === null) return "";
    if (typeof direct === "object") return JSON.stringify(direct);
    return String(direct);
  });
}

function parseTemplateJson(
  template: string | null | undefined,
  context: Record<string, unknown>,
  fallback: Record<string, unknown>,
) {
  const rendered = renderTemplateString(template, context);

  if (!rendered.trim()) return fallback;

  try {
    return JSON.parse(rendered) as unknown;
  } catch {
    return {
      ...fallback,
      raw: rendered,
    };
  }
}

function parseHeadersTemplate(
  template: string | null | undefined,
  context: Record<string, unknown>,
) {
  const rendered = renderTemplateString(template, context);

  if (!rendered.trim()) return {};

  try {
    const parsed = JSON.parse(rendered) as unknown;
    const record = asRecord(parsed);

    return Object.fromEntries(
      Object.entries(record)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => [key, String(value)]),
    );
  } catch {
    return {};
  }
}

async function callBusinessEndpoint({
  bodyTemplate,
  context,
  extraHeaders,
  headersTemplate,
  method,
  url,
}: {
  bodyTemplate?: string | null;
  context: Record<string, unknown>;
  extraHeaders?: Record<string, string>;
  headersTemplate?: string | null;
  method: string;
  url: string;
}) {
  const normalizedMethod = method === "GET" ? "GET" : method || "POST";
  const body = parseTemplateJson(bodyTemplate, context, {
    answers: asRecord(context.answers),
    last_reply: context.last_reply ?? null,
  });
  const headers = {
    "content-type": "application/json",
    ...parseHeadersTemplate(headersTemplate, context),
    ...(extraHeaders ?? {}),
  };
  const response = await fetch(url, {
    body: normalizedMethod === "GET" ? undefined : JSON.stringify(body),
    headers,
    method: normalizedMethod,
  });
  const text = await response.text();
  let data: unknown = text;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      `Business node request failed with ${response.status}: ${text.slice(0, 300)}`,
    );
  }

  return {
    data,
    status: response.status,
  };
}

function pickEdgeForCondition<
  TEdge extends {
    label: string | null;
  },
>(edges: TEdge[], result: boolean) {
  const positiveLabels = ["true", "yes", "match", "matched", "success"];
  const negativeLabels = ["false", "no", "else", "default", "fallback"];
  const wanted = result ? positiveLabels : negativeLabels;

  return (
    edges.find((edge) => wanted.includes(normalizedText(edge.label))) ??
    (result ? edges[0] : edges[1] ?? edges[0])
  );
}

async function recordSessionEvent({
  chatbotId,
  companyId,
  eventType,
  messageId,
  nodeId,
  payload,
  sessionId,
  versionId,
}: {
  chatbotId: string;
  companyId: string;
  eventType:
    | "SESSION_STARTED"
    | "TRIGGER_MATCHED"
    | "NODE_ENTERED"
    | "NODE_COMPLETED"
    | "MESSAGE_SENT"
    | "MESSAGE_RECEIVED"
    | "CONDITION_EVALUATED"
    | "API_CALL_STARTED"
    | "API_CALL_COMPLETED"
    | "ASSIGNED_AGENT"
    | "SESSION_COMPLETED"
    | "SESSION_FAILED";
  messageId?: string | null;
  nodeId?: string | null;
  payload?: unknown;
  sessionId: string;
  versionId?: string | null;
}) {
  await prisma.chatbotSessionEvent.create({
    data: {
      chatbotId,
      companyId,
      eventType,
      messageId: messageId ?? null,
      nodeId: nodeId ?? null,
      payload: safeJson(payload),
      sessionId,
      versionId: versionId ?? null,
    },
  });
}

async function queueChatbotOutboundMessage({
  body,
  chatbotId,
  companyId,
  contactId,
  metadata,
  nodeId,
  sessionId,
}: {
  body: string;
  chatbotId: string;
  companyId: string;
  contactId: string;
  metadata?: Record<string, unknown>;
  nodeId: string;
  sessionId: string;
}) {
  await assertSubscriptionCanSend(companyId);
  await assertCompanyMessageQuota(companyId);
  await assertUsageQuotaAvailable({
    amount: 1,
    companyId,
    featureKey: "BULK_MESSAGING",
  });

  const contact = await prisma.contact.findFirst({
    where: {
      companyId,
      id: contactId,
    },
  });

  if (!contact) {
    throw new Error("Chatbot contact not found");
  }

  const message = await prisma.$transaction(async (tx) => {
    await tx.wallet.upsert({
      where: {
        companyId,
      },
      update: {},
      create: {
        balancePaise: 0,
        companyId,
      },
    });

    const debit = await tx.wallet.updateMany({
      where: {
        balancePaise: {
          gte: MESSAGE_PRICE_PAISE,
        },
        companyId,
      },
      data: {
        balancePaise: {
          decrement: MESSAGE_PRICE_PAISE,
        },
      },
    });

    if (debit.count !== 1) {
      throw new Error("Insufficient wallet balance for chatbot reply");
    }

    const createdMessage = await tx.message.create({
      data: {
        body,
        companyId,
        contactId,
        direction: "OUTBOUND",
        metadata: safeJson({
          chatbotId,
          messageType: "CHATBOT",
          nodeId,
          sessionId,
          source: "chatbot_runtime",
          ...(metadata ?? {}),
        }),
        status: "QUEUED",
        toPhoneNumber: `${contact.countryCode}${contact.phoneNumber}`,
        variables: [],
        events: {
          create: {
            companyId,
            raw: {
              chatbotId,
              nodeId,
              reason: "Chatbot runtime reply queued",
              sessionId,
              source: "chatbot_runtime",
            },
            status: "QUEUED",
          },
        },
      },
    });

    const walletTransaction = await tx.walletTransaction.create({
      data: {
        amountPaise: MESSAGE_PRICE_PAISE,
        companyId,
        description: "Chatbot reply queued",
        referenceId: createdMessage.id,
        referenceType: "MESSAGE_USAGE",
        status: "SUCCESS",
        type: "DEBIT",
      },
    });

    await tx.messageUsageLedger.create({
      data: {
        amountPaise: MESSAGE_PRICE_PAISE,
        companyId,
        messageId: createdMessage.id,
        status: "CHARGED",
        walletTransactionId: walletTransaction.id,
      },
    });

    return createdMessage;
  });

  await getMessageQueue().add(
    "send-session-message",
    {
      companyId,
      messageId: message.id,
    },
    {
      jobId: message.id,
    },
  );

  await incrementUsageQuota({
    amount: 1,
    companyId,
    featureKey: "BULK_MESSAGING",
    idempotencyKey: `message-created:${message.id}`,
    metadata: {
      chatbotId,
      contactId,
      messageId: message.id,
      nodeId,
      sessionId,
    },
    reason: "message-created",
  });

  await recordContactActivity({
    companyId,
    contactId,
    metadata: {
      chatbotId,
      messageId: message.id,
      nodeId,
      sessionId,
    },
    title: "Chatbot sent message",
    type: "MESSAGE_OUTBOUND",
  });

  return message;
}

async function sendFallbackMessage({
  chatbotId,
  companyId,
  contactId,
  fallbackText,
  nodeId,
  sessionId,
  versionId,
}: {
  chatbotId: string;
  companyId: string;
  contactId: string;
  fallbackText: string;
  nodeId: string;
  sessionId: string;
  versionId?: string | null;
}) {
  const outbound = await queueChatbotOutboundMessage({
    body: fallbackText,
    chatbotId,
    companyId,
    contactId,
    metadata: {
      fallback: true,
    },
    nodeId,
    sessionId,
  });

  await recordSessionEvent({
    chatbotId,
    companyId,
    eventType: "MESSAGE_SENT",
    messageId: outbound.id,
    nodeId,
    payload: {
      type: "fallback",
    },
    sessionId,
    versionId,
  });
}

async function failSession({
  chatbotId,
  companyId,
  error,
  nodeId,
  sessionId,
  versionId,
}: {
  chatbotId: string;
  companyId: string;
  error: unknown;
  nodeId?: string | null;
  sessionId: string;
  versionId?: string | null;
}) {
  const message = error instanceof Error ? error.message : "Unknown chatbot error";

  await prisma.chatbotSession.update({
    where: {
      id: sessionId,
    },
    data: {
      status: "FAILED",
    },
  });
  await recordSessionEvent({
    chatbotId,
    companyId,
    eventType: "SESSION_FAILED",
    nodeId,
    payload: {
      error: message,
      nodeId: nodeId ?? null,
    },
    sessionId,
    versionId,
  });
}

async function executeSession({
  inboundMessageId,
  inboundText,
  sessionId,
}: {
  inboundMessageId?: string | null;
  inboundText?: string;
  sessionId: string;
}) {
  let session = await prisma.chatbotSession.findUnique({
    where: {
      id: sessionId,
    },
    include: {
      chatbot: true,
      currentNode: true,
      version: {
        include: {
          edges: {
            include: {
              targetNode: true,
            },
            orderBy: {
              sortOrder: "asc",
            },
          },
          nodes: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });

  if (!session || !session.version || session.chatbot.status !== "PUBLISHED") {
    return;
  }

  const initialSession = session;
  let lastNodeId = session.currentNodeId;

  try {
    const context = getContext(session.context);
    let currentNodeId = session.currentNodeId;

    if (
      inboundText &&
      session.status === "WAITING_FOR_REPLY" &&
      session.currentNode
    ) {
      context.last_reply = inboundText;

      const currentConfig = getConfig(session.currentNode.config);

      if (session.currentNode.type === "QUESTION") {
        const saveAs = textValue(currentConfig.saveAs, "answer");
        context.answers = {
          ...asRecord(context.answers),
          [saveAs]: inboundText,
        };
      }

      await recordSessionEvent({
        chatbotId: session.chatbotId,
        companyId: session.companyId,
        eventType: "MESSAGE_RECEIVED",
        messageId: inboundMessageId,
        nodeId: session.currentNode.id,
        payload: {
          text: inboundText,
        },
        sessionId: session.id,
        versionId: session.versionId,
      });

      const waitingNodeId = session.currentNode.id;
      lastNodeId = waitingNodeId;
      const outgoing = session.version.edges.filter(
        (edge) => edge.sourceNodeId === waitingNodeId,
      );
      const requiresChoice = ["QUICK_REPLY", "LIST_MENU", "MEDIA_BUTTONS"].includes(
        session.currentNode.type,
      );
      const nextEdge = requiresChoice
        ? findChoiceEdge(
            outgoing,
            inboundText,
            nodeChoiceValues(session.currentNode.type, currentConfig),
          )
        : pickEdgeForReply(outgoing, inboundText);

      if (requiresChoice && outgoing.length > 0 && !nextEdge) {
        await sendFallbackMessage({
          chatbotId: session.chatbotId,
          companyId: session.companyId,
          contactId: session.contactId!,
          fallbackText: fallbackMessageFor(session.chatbot.metadata, currentConfig),
          nodeId: session.currentNode.id,
          sessionId: session.id,
          versionId: session.versionId,
        });

        await prisma.chatbotSession.update({
          where: {
            id: session.id,
          },
          data: {
            context: safeJson(context),
            currentNodeId: session.currentNode.id,
            lastInteractionAt: new Date(),
            status: "WAITING_FOR_REPLY",
          },
        });

        return;
      }

      currentNodeId = nextEdge?.targetNodeId ?? null;

      await recordSessionEvent({
        chatbotId: session.chatbotId,
        companyId: session.companyId,
        eventType: "NODE_COMPLETED",
        nodeId: session.currentNode.id,
        payload: {
          nextNodeId: currentNodeId,
        },
        sessionId: session.id,
        versionId: session.versionId,
      });

      await prisma.chatbotSession.update({
        where: {
          id: session.id,
        },
        data: {
          context: safeJson(context),
          currentNodeId,
          lastInteractionAt: new Date(),
          status: currentNodeId ? "ACTIVE" : "COMPLETED",
          ...(currentNodeId ? {} : { completedAt: new Date() }),
        },
      });

      session = await prisma.chatbotSession.findUnique({
        where: {
          id: sessionId,
        },
        include: {
          chatbot: true,
          currentNode: true,
          version: {
            include: {
              edges: {
                include: {
                  targetNode: true,
                },
                orderBy: {
                  sortOrder: "asc",
                },
              },
              nodes: {
                orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
              },
            },
          },
        },
      });

      if (!session || !session.version || !currentNodeId) return;
    }

    for (let step = 0; step < MAX_RUNTIME_STEPS; step += 1) {
      const node = session.version.nodes.find((item) => item.id === currentNodeId);

      if (!node) {
        await prisma.chatbotSession.update({
          where: {
            id: session.id,
          },
          data: {
            completedAt: new Date(),
            status: "COMPLETED",
          },
        });
        await recordSessionEvent({
          chatbotId: session.chatbotId,
          companyId: session.companyId,
          eventType: "SESSION_COMPLETED",
          payload: {
            reason: "No current node",
          },
          sessionId: session.id,
          versionId: session.versionId,
        });
        return;
      }

      lastNodeId = node.id;
      const outgoing = session.version.edges.filter(
        (edge) => edge.sourceNodeId === node.id,
      );

      await recordSessionEvent({
        chatbotId: session.chatbotId,
        companyId: session.companyId,
        eventType: "NODE_ENTERED",
        nodeId: node.id,
        sessionId: session.id,
        versionId: session.versionId,
      });

      if (node.type === "END") {
        await prisma.chatbotSession.update({
          where: {
            id: session.id,
          },
          data: {
            completedAt: new Date(),
            currentNodeId: node.id,
            status: "COMPLETED",
          },
        });
        await recordSessionEvent({
          chatbotId: session.chatbotId,
          companyId: session.companyId,
          eventType: "SESSION_COMPLETED",
          nodeId: node.id,
          sessionId: session.id,
          versionId: session.versionId,
        });
        return;
      }

      if (node.type === "START") {
        const nextNodeId = outgoing[0]?.targetNodeId ?? null;
        currentNodeId = nextNodeId;
        await prisma.chatbotSession.update({
          where: {
            id: session.id,
          },
          data: {
            currentNodeId,
            status: currentNodeId ? "ACTIVE" : "COMPLETED",
            ...(currentNodeId ? {} : { completedAt: new Date() }),
          },
        });
        await recordSessionEvent({
          chatbotId: session.chatbotId,
          companyId: session.companyId,
          eventType: "NODE_COMPLETED",
          nodeId: node.id,
          payload: {
            nextNodeId,
          },
          sessionId: session.id,
          versionId: session.versionId,
        });
        if (!currentNodeId) return;
        continue;
      }

      const config = getConfig(node.config);

      if (node.type === "MESSAGE") {
        const body = textValue(config.body, node.name);
        const outbound = await queueChatbotOutboundMessage({
          body,
          chatbotId: session.chatbotId,
          companyId: session.companyId,
          contactId: session.contactId!,
          nodeId: node.id,
          sessionId: session.id,
        });
        await recordSessionEvent({
          chatbotId: session.chatbotId,
          companyId: session.companyId,
          eventType: "MESSAGE_SENT",
          messageId: outbound.id,
          nodeId: node.id,
          payload: {
            type: "text",
          },
          sessionId: session.id,
          versionId: session.versionId,
        });

        const nextNodeId = outgoing[0]?.targetNodeId ?? null;
        currentNodeId = nextNodeId;
        await prisma.chatbotSession.update({
          where: {
            id: session.id,
          },
          data: {
            currentNodeId,
            status: currentNodeId ? "ACTIVE" : "COMPLETED",
            ...(currentNodeId ? {} : { completedAt: new Date() }),
          },
        });
        if (!currentNodeId) return;
        continue;
      }

      if (node.type === "QUICK_REPLY") {
        const body = textValue(config.body, node.name);
        const buttons = buttonValues(config.buttons);
        const outbound = await queueChatbotOutboundMessage({
          body,
          chatbotId: session.chatbotId,
          companyId: session.companyId,
          contactId: session.contactId!,
          metadata: {
            body,
            buttons,
            messageType: "INTERACTIVE",
            type: "Reply Button",
          },
          nodeId: node.id,
          sessionId: session.id,
        });
        await recordSessionEvent({
          chatbotId: session.chatbotId,
          companyId: session.companyId,
          eventType: "MESSAGE_SENT",
          messageId: outbound.id,
          nodeId: node.id,
          payload: {
            buttons,
            type: "reply_button",
          },
          sessionId: session.id,
          versionId: session.versionId,
        });
        await prisma.chatbotSession.update({
          where: {
            id: session.id,
          },
          data: {
            currentNodeId: node.id,
            lastInteractionAt: new Date(),
            status: "WAITING_FOR_REPLY",
          },
        });
        return;
      }

      if (node.type === "LIST_MENU") {
        const body = textValue(config.body, node.name);
        const sections = listSections(config.sections);
        const outbound = await queueChatbotOutboundMessage({
          body,
          chatbotId: session.chatbotId,
          companyId: session.companyId,
          contactId: session.contactId!,
          metadata: {
            body,
            footer: textValue(config.footer) || null,
            header: textValue(config.header) || null,
            messageType: "INTERACTIVE",
            primaryButton: textValue(config.primaryButton, "View options"),
            sections,
            type: "List Button",
          },
          nodeId: node.id,
          sessionId: session.id,
        });
        await recordSessionEvent({
          chatbotId: session.chatbotId,
          companyId: session.companyId,
          eventType: "MESSAGE_SENT",
          messageId: outbound.id,
          nodeId: node.id,
          payload: {
            rows: sections.reduce(
              (total, section) => total + section.rows.length,
              0,
            ),
            type: "list_menu",
          },
          sessionId: session.id,
          versionId: session.versionId,
        });
        await prisma.chatbotSession.update({
          where: {
            id: session.id,
          },
          data: {
            currentNodeId: node.id,
            lastInteractionAt: new Date(),
            status: "WAITING_FOR_REPLY",
          },
        });
        return;
      }

      if (node.type === "MEDIA_BUTTONS") {
        const body = textValue(config.body, node.name);
        const buttons = buttonValues(config.buttons);
        const outbound = await queueChatbotOutboundMessage({
          body,
          chatbotId: session.chatbotId,
          companyId: session.companyId,
          contactId: session.contactId!,
          metadata: {
            body,
            buttons,
            footer: textValue(config.footer) || null,
            headerMediaId: textValue(config.headerMediaId) || null,
            headerMediaName: textValue(config.headerMediaName) || null,
            headerMediaType: textValue(config.headerMediaType, "IMAGE"),
            headerMediaUrl: textValue(config.headerMediaUrl) || null,
            messageType: "INTERACTIVE",
            type: "Reply Button",
          },
          nodeId: node.id,
          sessionId: session.id,
        });
        await recordSessionEvent({
          chatbotId: session.chatbotId,
          companyId: session.companyId,
          eventType: "MESSAGE_SENT",
          messageId: outbound.id,
          nodeId: node.id,
          payload: {
            buttons,
            mediaType: textValue(config.headerMediaType, "IMAGE"),
            type: "media_buttons",
          },
          sessionId: session.id,
          versionId: session.versionId,
        });
        await prisma.chatbotSession.update({
          where: {
            id: session.id,
          },
          data: {
            currentNodeId: node.id,
            lastInteractionAt: new Date(),
            status: "WAITING_FOR_REPLY",
          },
        });
        return;
      }

      if (node.type === "QUESTION") {
        const body = textValue(config.body, node.name);
        const outbound = await queueChatbotOutboundMessage({
          body,
          chatbotId: session.chatbotId,
          companyId: session.companyId,
          contactId: session.contactId!,
          nodeId: node.id,
          sessionId: session.id,
        });
        await recordSessionEvent({
          chatbotId: session.chatbotId,
          companyId: session.companyId,
          eventType: "MESSAGE_SENT",
          messageId: outbound.id,
          nodeId: node.id,
          payload: {
            saveAs: textValue(config.saveAs, "answer"),
            type: "question",
          },
          sessionId: session.id,
          versionId: session.versionId,
        });
        await prisma.chatbotSession.update({
          where: {
            id: session.id,
          },
          data: {
            currentNodeId: node.id,
            lastInteractionAt: new Date(),
            status: "WAITING_FOR_REPLY",
          },
        });
        return;
      }

      if (node.type === "CONDITION") {
        const result = evaluateCondition(config, context);
        const edge = pickEdgeForCondition(outgoing, result);
        currentNodeId = edge?.targetNodeId ?? null;
        await recordSessionEvent({
          chatbotId: session.chatbotId,
          companyId: session.companyId,
          eventType: "CONDITION_EVALUATED",
          nodeId: node.id,
          payload: {
            result,
            nextNodeId: currentNodeId,
          },
          sessionId: session.id,
          versionId: session.versionId,
        });
        await prisma.chatbotSession.update({
          where: {
            id: session.id,
          },
          data: {
            currentNodeId,
            status: currentNodeId ? "ACTIVE" : "COMPLETED",
            ...(currentNodeId ? {} : { completedAt: new Date() }),
          },
        });
        if (!currentNodeId) return;
        continue;
      }

      if (
        node.type === "API_CALL" ||
        node.type === "WEBHOOK" ||
        node.type === "GOOGLE_SHEET_SAVE" ||
        node.type === "TALLY_INVOICE_LOOKUP" ||
        node.type === "TALLY_LEDGER_BALANCE"
      ) {
        const responseField = textValue(config.responseField, "business_result");
        const url =
          node.type === "GOOGLE_SHEET_SAVE"
            ? textValue(config.url)
            : node.type === "TALLY_INVOICE_LOOKUP" ||
                node.type === "TALLY_LEDGER_BALANCE"
              ? textValue(config.endpointUrl)
              : textValue(config.url);

        if (!url) {
          throw new Error(`${node.type} endpoint URL is missing`);
        }

        await recordSessionEvent({
          chatbotId: session.chatbotId,
          companyId: session.companyId,
          eventType: "API_CALL_STARTED",
          nodeId: node.id,
          payload: {
            method: textValue(config.method, "POST"),
            type: node.type,
            url,
          },
          sessionId: session.id,
          versionId: session.versionId,
        });

        const tallyBody =
          node.type === "TALLY_INVOICE_LOOKUP" ||
          node.type === "TALLY_LEDGER_BALANCE"
            ? JSON.stringify({
                answers: asRecord(context.answers),
                lookupType: config.lookupType,
                search: fieldValue(
                  context,
                  textValue(config.searchField, "last_reply"),
                ),
              })
            : null;
        const sheetBody =
          node.type === "GOOGLE_SHEET_SAVE"
            ? textValue(config.payloadTemplate) ||
              JSON.stringify({
                answers: asRecord(context.answers),
                last_reply: context.last_reply ?? null,
              })
            : null;
        const result = await callBusinessEndpoint({
          bodyTemplate:
            tallyBody ?? sheetBody ?? (textValue(config.bodyTemplate) || null),
          context,
          extraHeaders:
            node.type === "WEBHOOK" && textValue(config.secret)
              ? { "x-chatbot-secret": textValue(config.secret) }
              : undefined,
          headersTemplate: textValue(config.headersTemplate) || null,
          method:
            node.type === "GOOGLE_SHEET_SAVE" ||
            node.type === "TALLY_INVOICE_LOOKUP" ||
            node.type === "TALLY_LEDGER_BALANCE"
              ? "POST"
              : textValue(config.method, "POST"),
          url,
        });

        context.answers = {
          ...asRecord(context.answers),
          [responseField]: result.data,
        };

        await recordSessionEvent({
          chatbotId: session.chatbotId,
          companyId: session.companyId,
          eventType: "API_CALL_COMPLETED",
          nodeId: node.id,
          payload: {
            responseField,
            status: result.status,
            type: node.type,
          },
          sessionId: session.id,
          versionId: session.versionId,
        });

        const successMessage = textValue(config.successMessage);

        if (successMessage) {
          const outbound = await queueChatbotOutboundMessage({
            body: renderTemplateString(successMessage, context),
            chatbotId: session.chatbotId,
            companyId: session.companyId,
            contactId: session.contactId!,
            nodeId: node.id,
            sessionId: session.id,
          });

          await recordSessionEvent({
            chatbotId: session.chatbotId,
            companyId: session.companyId,
            eventType: "MESSAGE_SENT",
            messageId: outbound.id,
            nodeId: node.id,
            payload: {
              type: "business_node_success",
            },
            sessionId: session.id,
            versionId: session.versionId,
          });
        }

        currentNodeId = outgoing[0]?.targetNodeId ?? null;
        await prisma.chatbotSession.update({
          where: {
            id: session.id,
          },
          data: {
            context: safeJson(context),
            currentNodeId,
            status: currentNodeId ? "ACTIVE" : "COMPLETED",
            ...(currentNodeId ? {} : { completedAt: new Date() }),
          },
        });
        if (!currentNodeId) return;
        continue;
      }

      if (node.type === "CATALOG_PRODUCT_CARD") {
        const productTitle = textValue(config.productTitle, "Product");
        const productDescription = textValue(config.productDescription);
        const body = textValue(
          config.body,
          [productTitle, productDescription].filter(Boolean).join("\n"),
        );
        const productUrl = textValue(config.productUrl);
        const metadata = productUrl
          ? {
              body,
              ctaUrl: productUrl,
              headerMediaType: textValue(config.productImageUrl) ? "IMAGE" : null,
              headerMediaUrl: textValue(config.productImageUrl) || null,
              messageType: "INTERACTIVE",
              primaryButton: "View product",
              type: "CTA Button",
            }
          : undefined;
        const outbound = await queueChatbotOutboundMessage({
          body,
          chatbotId: session.chatbotId,
          companyId: session.companyId,
          contactId: session.contactId!,
          metadata,
          nodeId: node.id,
          sessionId: session.id,
        });

        await recordSessionEvent({
          chatbotId: session.chatbotId,
          companyId: session.companyId,
          eventType: "MESSAGE_SENT",
          messageId: outbound.id,
          nodeId: node.id,
          payload: {
            productRetailerId: config.productRetailerId ?? null,
            productTitle,
            type: "catalog_product_card",
          },
          sessionId: session.id,
          versionId: session.versionId,
        });

        currentNodeId = outgoing[0]?.targetNodeId ?? null;
        await prisma.chatbotSession.update({
          where: {
            id: session.id,
          },
          data: {
            currentNodeId,
            status: currentNodeId ? "ACTIVE" : "COMPLETED",
            ...(currentNodeId ? {} : { completedAt: new Date() }),
          },
        });
        if (!currentNodeId) return;
        continue;
      }

      if (node.type === "PAYMENT_LINK") {
        const body = textValue(config.body, "Please complete payment.");
        const paymentUrl = textValue(config.paymentLinkUrl);
        const outbound = await queueChatbotOutboundMessage({
          body,
          chatbotId: session.chatbotId,
          companyId: session.companyId,
          contactId: session.contactId!,
          metadata: {
            body,
            ctaUrl: paymentUrl,
            messageType: "INTERACTIVE",
            primaryButton: textValue(config.primaryButton, "Pay now"),
            type: "CTA Button",
          },
          nodeId: node.id,
          sessionId: session.id,
        });

        await recordSessionEvent({
          chatbotId: session.chatbotId,
          companyId: session.companyId,
          eventType: "MESSAGE_SENT",
          messageId: outbound.id,
          nodeId: node.id,
          payload: {
            amount: config.amount ?? null,
            type: "payment_link",
          },
          sessionId: session.id,
          versionId: session.versionId,
        });

        currentNodeId = outgoing[0]?.targetNodeId ?? null;
        await prisma.chatbotSession.update({
          where: {
            id: session.id,
          },
          data: {
            currentNodeId,
            status: currentNodeId ? "ACTIVE" : "COMPLETED",
            ...(currentNodeId ? {} : { completedAt: new Date() }),
          },
        });
        if (!currentNodeId) return;
        continue;
      }

      if (node.type === "AI_REPLY") {
        const reply =
          renderTemplateString(textValue(config.fallback), context) ||
          `Thanks. I noted: ${String(context.last_reply ?? "").trim() || "your request"}.`;
        const responseField = textValue(config.responseField, "ai_reply");

        context.answers = {
          ...asRecord(context.answers),
          [responseField]: reply,
        };

        const outbound = await queueChatbotOutboundMessage({
          body: reply,
          chatbotId: session.chatbotId,
          companyId: session.companyId,
          contactId: session.contactId!,
          nodeId: node.id,
          sessionId: session.id,
        });

        await recordSessionEvent({
          chatbotId: session.chatbotId,
          companyId: session.companyId,
          eventType: "MESSAGE_SENT",
          messageId: outbound.id,
          nodeId: node.id,
          payload: {
            mode: "fallback",
            responseField,
            type: "ai_reply",
          },
          sessionId: session.id,
          versionId: session.versionId,
        });

        currentNodeId = outgoing[0]?.targetNodeId ?? null;
        await prisma.chatbotSession.update({
          where: {
            id: session.id,
          },
          data: {
            context: safeJson(context),
            currentNodeId,
            status: currentNodeId ? "ACTIVE" : "COMPLETED",
            ...(currentNodeId ? {} : { completedAt: new Date() }),
          },
        });
        if (!currentNodeId) return;
        continue;
      }

      if (node.type === "ASSIGN_AGENT") {
        const note = textValue(
          config.note,
          "Thanks. Our team will contact you shortly.",
        );
        const handoffReason = textValue(
          config.handoffReason ?? config.reason,
          "Chatbot requested human handoff",
        );
        const requestedQueueId =
          optionalString(config.queueId) ??
          optionalString(config.requestedQueueId) ??
          optionalString(config.inboxQueueId);
        const assignmentMode = optionalAssignmentMode(config.assignmentMode);
        const requiredSkillIds = stringArray(config.requiredSkillIds);
        const outbound = await queueChatbotOutboundMessage({
          body: note,
          chatbotId: session.chatbotId,
          companyId: session.companyId,
          contactId: session.contactId!,
          nodeId: node.id,
          sessionId: session.id,
        });
        await recordSessionEvent({
          chatbotId: session.chatbotId,
          companyId: session.companyId,
          eventType: "ASSIGNED_AGENT",
          messageId: outbound.id,
          nodeId: node.id,
          payload: {
            assignTo: config.assignTo ?? null,
            assignmentMode: assignmentMode ?? null,
            handoffReason,
            requestedQueueId: requestedQueueId ?? null,
            requiredSkillIds,
          },
          sessionId: session.id,
          versionId: session.versionId,
        });

        if (session.contactId) {
          if (requestedQueueId) {
            await assignConversationToBestAgent({
              assignmentMode,
              companyId: session.companyId,
              contactId: session.contactId,
              metadata: safeJson({
                chatbotId: session.chatbotId,
                nodeId: node.id,
                outboundMessageId: outbound.id,
                sessionId: session.id,
              }),
              queueId: requestedQueueId,
              reason: handoffReason,
              requiredSkillIds,
              source: InboxAssignmentSource.CHATBOT,
            });
          } else {
            await routeConversation({
              companyId: session.companyId,
              contactId: session.contactId,
              handoffReason,
              metadata: safeJson({
                chatbotId: session.chatbotId,
                nodeId: node.id,
                outboundMessageId: outbound.id,
                sessionId: session.id,
              }),
              source: InboxAssignmentSource.CHATBOT,
            });
          }
        }

        await prisma.chatbotSession.update({
          where: {
            id: session.id,
          },
          data: {
            currentNodeId: node.id,
            handoffAt: new Date(),
            lastInteractionAt: new Date(),
            status: "HANDED_OFF",
          },
        });
        return;
      }
    }

    throw new Error("Chatbot runtime stopped after too many steps");
  } catch (error) {
    await failSession({
      chatbotId: initialSession.chatbotId,
      companyId: initialSession.companyId,
      error,
      nodeId: lastNodeId,
      sessionId: initialSession.id,
      versionId: initialSession.versionId,
    });
    throw error;
  }
}

async function findActiveSession({
  companyId,
  contactId,
}: {
  companyId: string;
  contactId: string;
}) {
  return prisma.chatbotSession.findFirst({
    where: {
      companyId,
      contactId,
      status: {
        in: [...ACTIVE_SESSION_STATUSES],
      },
      chatbot: {
        status: "PUBLISHED",
      },
    },
    orderBy: {
      lastInteractionAt: "desc",
    },
  });
}

async function getInboundTemplateContext({
  companyId,
  inboundMessage,
}: {
  companyId: string;
  inboundMessage: {
    metadata: Prisma.JsonValue | null;
  };
}): Promise<TemplateTriggerContext | null> {
  const metadata = asRecord(inboundMessage.metadata);
  const contextMetaMessageId = textValue(metadata.contextMetaMessageId);

  if (!contextMetaMessageId) return null;

  const previousMessage = await prisma.message.findFirst({
    where: {
      companyId,
      direction: "OUTBOUND",
      metaMessageId: contextMetaMessageId,
      templateId: {
        not: null,
      },
    },
    include: {
      template: {
        select: {
          id: true,
          language: true,
          metaTemplateId: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!previousMessage?.template) return null;

  return {
    language: previousMessage.template.language,
    messageId: previousMessage.id,
    metaTemplateId: previousMessage.template.metaTemplateId,
    templateId: previousMessage.template.id,
    templateName: previousMessage.template.name,
  };
}

async function findMatchingTrigger({
  body,
  companyId,
  contactId,
  templateContext,
}: {
  body: string;
  companyId: string;
  contactId: string;
  templateContext?: TemplateTriggerContext | null;
}) {
  const triggers = await prisma.chatbotTrigger.findMany({
    where: {
      companyId,
      isEnabled: true,
      chatbot: {
        activeVersionId: {
          not: null,
        },
        status: "PUBLISHED",
      },
    },
    include: {
      chatbot: {
        include: {
          activeVersion: {
            include: {
              nodes: {
                orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
              },
            },
          },
        },
      },
    },
    orderBy: {
      priority: "asc",
    },
  });

  const previousSessions = await prisma.chatbotSession.findMany({
    where: {
      companyId,
      contactId,
    },
    select: {
      chatbotId: true,
    },
  });
  const previousChatbotIds = new Set(
    previousSessions.map((session) => session.chatbotId),
  );

  return triggers.find((trigger) => {
    if (!trigger.chatbot.activeVersion) return false;
    if (
      trigger.type === "DEFAULT_WELCOME" &&
      previousChatbotIds.has(trigger.chatbotId)
    ) {
      return false;
    }

    return matchesTrigger({ body, templateContext, trigger });
  });
}

export async function startChatbotWhatsAppTest({
  actorUserId,
  chatbotId,
  companyId,
  input,
}: {
  actorUserId: string;
  chatbotId: string;
  companyId: string;
  input: StartChatbotWhatsAppTestInput;
}) {
  const chatbot = await prisma.chatbot.findFirst({
    where: {
      activeVersionId: {
        not: null,
      },
      companyId,
      id: chatbotId,
      status: "PUBLISHED",
    },
    include: {
      activeVersion: {
        include: {
          nodes: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });

  if (!chatbot?.activeVersion) {
    throw new Error("Publish the chatbot before sending a WhatsApp test");
  }

  const startNode = chatbot.activeVersion.nodes.find(
    (node) => node.type === "START",
  );

  if (!startNode) {
    throw new Error("Start node is required before testing");
  }

  const countryCode = normalizePhoneDigits(input.countryCode);
  const phoneNumber = normalizePhoneDigits(input.phoneNumber);

  await assertSubscriptionCanSend(companyId);
  await assertCompanyMessageQuota(companyId);
  await assertUsageQuotaAvailable({
    amount: 1,
    companyId,
    featureKey: "BULK_MESSAGING",
  });

  const { contact, session } = await prisma.$transaction(async (tx) => {
    const contactRecord = await tx.contact.upsert({
      where: {
        companyId_phoneNumber: {
          companyId,
          phoneNumber,
        },
      },
      update: {
        countryCode,
        ...(input.name?.trim() ? { name: input.name.trim() } : {}),
        inboxStatus: "OPEN",
      },
      create: {
        companyId,
        countryCode,
        name: input.name?.trim() || "Chatbot test contact",
        phoneNumber,
        source: "CHATBOT_TEST",
      },
    });

    await tx.chatbotSession.updateMany({
      where: {
        chatbotId,
        companyId,
        contactId: contactRecord.id,
        status: {
          in: [...ACTIVE_SESSION_STATUSES],
        },
      },
      data: {
        completedAt: new Date(),
        status: "ABANDONED",
      },
    });

    const sessionRecord = await tx.chatbotSession.create({
      data: {
        chatbotId,
        companyId,
        contactId: contactRecord.id,
        context: safeJson({
          answers: {},
          actorUserId,
          test: true,
          triggerText: input.testMessage?.trim() || "dashboard_test",
        }),
        currentNodeId: startNode.id,
        lastInteractionAt: new Date(),
        metadata: safeJson({
          actorUserId,
          source: "dashboard_whatsapp_test",
        }),
        status: "ACTIVE",
        versionId: chatbot.activeVersion!.id,
      },
    });

    return {
      contact: contactRecord,
      session: sessionRecord,
    };
  });

  await recordSessionEvent({
    chatbotId,
    companyId,
    eventType: "SESSION_STARTED",
    payload: {
      contactId: contact.id,
      phoneNumber: `+${countryCode}${phoneNumber}`,
      source: "dashboard_whatsapp_test",
      testMessage: input.testMessage?.trim() || null,
    },
    sessionId: session.id,
    versionId: session.versionId,
  });
  await recordSessionEvent({
    chatbotId,
    companyId,
    eventType: "TRIGGER_MATCHED",
    payload: {
      source: "dashboard_whatsapp_test",
      triggerType: "MANUAL",
      triggerValue: input.testMessage?.trim() || "dashboard_test",
    },
    sessionId: session.id,
    versionId: session.versionId,
  });

  await executeSession({
    sessionId: session.id,
  });

  return {
    contact,
    session,
  };
}

export async function processChatbotInboundMessage({
  companyId,
  contactId,
  inboundMessageId,
}: {
  companyId: string;
  contactId: string;
  inboundMessageId: string;
}): Promise<ChatbotInboundOutcome> {
  const inboundMessage = await prisma.message.findFirst({
    where: {
      companyId,
      contactId,
      direction: "INBOUND",
      id: inboundMessageId,
    },
  });

  if (!inboundMessage) return { handled: false, handedOff: false };

  const inboundText = getInboundReplyText(inboundMessage);
  const normalized = normalizedText(inboundText);

  if (!normalized || ["stop", "start"].includes(normalized)) {
    return { handled: false, handedOff: false };
  }

  const templateContext = await getInboundTemplateContext({
    companyId,
    inboundMessage,
  });

  const activeSession = await findActiveSession({ companyId, contactId });

  if (activeSession) {
    await executeSession({
      inboundMessageId,
      inboundText,
      sessionId: activeSession.id,
    });
    const latestSession = await prisma.chatbotSession.findUnique({
      where: {
        id: activeSession.id,
      },
      select: {
        status: true,
      },
    });

    return {
      handled: true,
      handedOff: latestSession?.status === "HANDED_OFF",
      handoffReason:
        latestSession?.status === "HANDED_OFF"
          ? "Chatbot requested human handoff"
          : undefined,
      sessionId: activeSession.id,
    };
  }

  const trigger = await findMatchingTrigger({
    body: inboundText,
    companyId,
    contactId,
    templateContext,
  });

  if (!trigger?.chatbot.activeVersion) {
    return { handled: false, handedOff: false };
  }

  const startNode = trigger.chatbot.activeVersion.nodes.find(
    (node) => node.type === "START",
  );

  if (!startNode) return { handled: false, handedOff: false };

  const session = await prisma.chatbotSession.create({
    data: {
      chatbotId: trigger.chatbotId,
      companyId,
      contactId,
      context: safeJson({
        answers: {},
        last_reply: inboundText,
        templateTrigger: templateContext,
        triggerText: inboundText,
      }),
      currentNodeId: startNode.id,
      lastInteractionAt: new Date(),
      status: "ACTIVE",
      triggerId: trigger.id,
      versionId: trigger.chatbot.activeVersion.id,
    },
  });

  await recordSessionEvent({
    chatbotId: session.chatbotId,
    companyId,
    eventType: "SESSION_STARTED",
    messageId: inboundMessageId,
    payload: {
      contactId,
      inboundText,
    },
    sessionId: session.id,
    versionId: session.versionId,
  });
  await recordSessionEvent({
    chatbotId: session.chatbotId,
    companyId,
    eventType: "TRIGGER_MATCHED",
    messageId: inboundMessageId,
    payload: {
      triggerId: trigger.id,
      templateContext,
      triggerType: trigger.type,
      triggerValue: trigger.value,
    },
    sessionId: session.id,
    versionId: session.versionId,
  });

  await executeSession({
    inboundMessageId,
    sessionId: session.id,
  });

  const latestSession = await prisma.chatbotSession.findUnique({
    where: {
      id: session.id,
    },
    select: {
      status: true,
    },
  });

  return {
    handled: true,
    handedOff: latestSession?.status === "HANDED_OFF",
    handoffReason:
      latestSession?.status === "HANDED_OFF"
        ? "Chatbot requested human handoff"
        : undefined,
    sessionId: session.id,
  };
}
