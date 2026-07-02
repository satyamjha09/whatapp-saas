import crypto from "crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  CreateChatbotEdgeInput,
  CreateChatbotInput,
  CreateChatbotNodeInput,
  CreateChatbotTriggerInput,
  UpdateChatbotFallbackInput,
  UpdateChatbotStatusInput,
} from "@/server/validators/chatbot.validator";

function safeJson(value: unknown): Prisma.InputJsonValue {
  return (value ?? Prisma.JsonNull) as Prisma.InputJsonValue;
}

function parseKeywords(value: string | null | undefined) {
  return Array.from(
    new Set(
      (value ?? "")
        .split(",")
        .map((keyword) => keyword.trim().toLowerCase())
        .filter(Boolean),
    ),
  ).slice(0, 20);
}

function parseButtons(value: string | null | undefined) {
  return Array.from(
    new Set(
      (value ?? "")
        .split(",")
        .map((button) => button.trim())
        .map((button) => button.slice(0, 20))
        .filter(Boolean),
    ),
  ).slice(0, 3);
}

function parseListRows(value: string | null | undefined) {
  const parsedRows = (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title = "", description = ""] = line.split("|");
      const normalizedTitle = title.trim().slice(0, 24);

      return {
        title: normalizedTitle,
        description: description.trim().slice(0, 72) || null,
      };
    })
    .filter((row) => row.title);

  const rows = Array.from(
    new Map(
      parsedRows.map((row) => [row.title.toLowerCase(), row]),
    ).values(),
  ).slice(0, 10);

  return rows.length > 0
    ? [
        {
          title: "Options",
          rows,
        },
      ]
    : [];
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function payloadText(value: unknown) {
  const record = jsonRecord(value);
  return typeof record.text === "string" ? record.text : "";
}

function includesAnyTerm(value: string, terms: string[]) {
  const normalized = value.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function rateBps(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 10000) : 0;
}

type SegmentSession = {
  contact: {
    countryCode: string;
    id: string;
    lifecycleStage: string;
    name: string | null;
    phoneNumber: string;
  } | null;
  currentNode: {
    id: string;
    name: string;
    type: string;
  } | null;
  id: string;
  lastInteractionAt: Date;
  status: string;
};

function segmentContact(session: SegmentSession, reason: string) {
  if (!session.contact) return null;

  return {
    contactId: session.contact.id,
    currentNodeName: session.currentNode?.name ?? null,
    currentNodeType: session.currentNode?.type ?? null,
    lastInteractionAt: session.lastInteractionAt,
    lifecycleStage: session.contact.lifecycleStage,
    name: session.contact.name,
    phone: `+${session.contact.countryCode}${session.contact.phoneNumber}`,
    reason,
    sessionId: session.id,
    status: session.status,
  };
}

function uniqueSegmentContacts(
  contacts: Array<ReturnType<typeof segmentContact>>,
) {
  const byContactId = new Map<string, NonNullable<(typeof contacts)[number]>>();

  for (const contact of contacts) {
    if (!contact || byContactId.has(contact.contactId)) continue;
    byContactId.set(contact.contactId, contact);
  }

  return Array.from(byContactId.values()).slice(0, 25);
}

function fieldKeyFromName(name: string) {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "answer";
}

function createNodeKey(type: string) {
  return `${type.toLowerCase()}_${crypto.randomUUID().slice(0, 8)}`;
}

function buildNodeConfig(input: CreateChatbotNodeInput) {
  const body = input.body?.trim() ?? "";
  const fallbackMessage = input.fallbackMessage?.trim() || null;

  if (input.type === "MESSAGE") {
    return {
      body,
    };
  }

  if (input.type === "QUICK_REPLY") {
    const buttons = parseButtons(input.buttons);

    if (buttons.length === 0) {
      throw new Error("Add at least one quick reply button");
    }

    return {
      body,
      buttons,
      fallbackMessage,
    };
  }

  if (input.type === "LIST_MENU") {
    const sections = parseListRows(input.listRows);

    if (!input.primaryButton?.trim() || sections.length === 0) {
      throw new Error("List button text and at least one row are required");
    }

    return {
      body,
      fallbackMessage,
      footer: input.footer?.trim() || null,
      header: input.header?.trim() || null,
      primaryButton: input.primaryButton.trim(),
      sections,
    };
  }

  if (input.type === "MEDIA_BUTTONS") {
    const buttons = parseButtons(input.buttons);

    if (buttons.length === 0) {
      throw new Error("Add at least one media button");
    }

    if (!input.mediaType || (!input.mediaUrl?.trim() && !input.mediaId?.trim())) {
      throw new Error("Media type and media URL or Meta media ID are required");
    }

    return {
      body,
      buttons,
      fallbackMessage,
      footer: input.footer?.trim() || null,
      headerMediaId: input.mediaId?.trim() || null,
      headerMediaName: input.mediaName?.trim() || null,
      headerMediaType: input.mediaType,
      headerMediaUrl: input.mediaUrl?.trim() || null,
    };
  }

  if (input.type === "QUESTION") {
    return {
      body,
      saveAs: input.questionField?.trim() || fieldKeyFromName(input.name),
    };
  }

  if (input.type === "CONDITION") {
    return {
      field: input.questionField?.trim() || "last_reply",
      operator: input.conditionOperator,
      value: input.conditionValue?.trim() || null,
    };
  }

  if (input.type === "API_CALL") {
    return {
      bodyTemplate: input.apiBody?.trim() || null,
      headersTemplate: input.apiHeaders?.trim() || null,
      method: input.apiMethod,
      responseField: input.responseField?.trim() || fieldKeyFromName(input.name),
      successMessage: input.successMessage?.trim() || null,
      url: input.apiUrl?.trim() || "",
    };
  }

  if (input.type === "WEBHOOK") {
    return {
      bodyTemplate: input.apiBody?.trim() || null,
      headersTemplate: input.apiHeaders?.trim() || null,
      method: input.apiMethod,
      responseField: input.responseField?.trim() || fieldKeyFromName(input.name),
      secret: input.webhookSecret?.trim() || null,
      successMessage: input.successMessage?.trim() || null,
      url: input.webhookUrl?.trim() || input.apiUrl?.trim() || "",
    };
  }

  if (input.type === "GOOGLE_SHEET_SAVE") {
    return {
      payloadTemplate: input.sheetPayload?.trim() || null,
      responseField: input.responseField?.trim() || "google_sheet_result",
      successMessage:
        input.successMessage?.trim() || "Details saved successfully.",
      url: input.sheetWebhookUrl?.trim() || "",
    };
  }

  if (
    input.type === "TALLY_INVOICE_LOOKUP" ||
    input.type === "TALLY_LEDGER_BALANCE"
  ) {
    return {
      endpointUrl: input.tallyEndpointUrl?.trim() || "",
      lookupType:
        input.type === "TALLY_INVOICE_LOOKUP" ? "invoice" : "ledger_balance",
      responseField:
        input.responseField?.trim() ||
        (input.type === "TALLY_INVOICE_LOOKUP"
          ? "tally_invoice"
          : "tally_ledger_balance"),
      searchField: input.tallySearchField?.trim() || "last_reply",
      successMessage: input.successMessage?.trim() || null,
    };
  }

  if (input.type === "CATALOG_PRODUCT_CARD") {
    return {
      body: body || input.productDescription?.trim() || input.productTitle?.trim(),
      productDescription: input.productDescription?.trim() || null,
      productImageUrl: input.productImageUrl?.trim() || null,
      productRetailerId: input.productRetailerId?.trim() || null,
      productTitle: input.productTitle?.trim() || "",
      productUrl: input.productUrl?.trim() || null,
    };
  }

  if (input.type === "PAYMENT_LINK") {
    return {
      amount: input.paymentAmount?.trim() || null,
      body: body || input.paymentDescription?.trim() || "Please complete payment.",
      description: input.paymentDescription?.trim() || null,
      paymentLinkUrl: input.paymentLinkUrl?.trim() || "",
      primaryButton: input.primaryButton?.trim() || "Pay now",
    };
  }

  if (input.type === "AI_REPLY") {
    return {
      fallback: input.aiFallback?.trim() || null,
      prompt: input.aiPrompt?.trim() || "",
      responseField: input.responseField?.trim() || "ai_reply",
    };
  }

  return {
    assignTo: input.assignTo?.trim() || null,
    note: body || "Assign conversation to an agent.",
  };
}

export function getChatbotsByCompany(companyId: string) {
  return prisma.chatbot.findMany({
    where: {
      companyId,
      status: {
        not: "ARCHIVED",
      },
    },
    include: {
      activeVersion: {
        select: {
          id: true,
          status: true,
          versionNumber: true,
        },
      },
      _count: {
        select: {
          sessions: true,
          triggers: true,
          versions: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function getChatbotFoundationStats(companyId: string) {
  const [total, draft, published, paused, activeSessions] = await Promise.all([
    prisma.chatbot.count({
      where: {
        companyId,
        status: {
          not: "ARCHIVED",
        },
      },
    }),
    prisma.chatbot.count({
      where: {
        companyId,
        status: "DRAFT",
      },
    }),
    prisma.chatbot.count({
      where: {
        companyId,
        status: "PUBLISHED",
      },
    }),
    prisma.chatbot.count({
      where: {
        companyId,
        status: "PAUSED",
      },
    }),
    prisma.chatbotSession.count({
      where: {
        companyId,
        status: {
          in: ["ACTIVE", "WAITING_FOR_REPLY"],
        },
      },
    }),
  ]);

  return {
    activeSessions,
    draft,
    paused,
    published,
    total,
  };
}

export async function getChatbotBuilder({
  chatbotId,
  companyId,
}: {
  chatbotId: string;
  companyId: string;
}) {
  const chatbot = await prisma.chatbot.findFirst({
    where: {
      companyId,
      id: chatbotId,
    },
    include: {
      activeVersion: true,
      triggers: {
        orderBy: [{ isEnabled: "desc" }, { priority: "asc" }],
      },
      sessions: {
        include: {
          contact: {
            select: {
              countryCode: true,
              id: true,
              name: true,
              phoneNumber: true,
            },
          },
          currentNode: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          _count: {
            select: {
              events: true,
            },
          },
        },
        orderBy: {
          lastInteractionAt: "desc",
        },
        take: 10,
      },
      versions: {
        include: {
          edges: {
            include: {
              sourceNode: {
                select: {
                  id: true,
                  name: true,
                  nodeKey: true,
                  type: true,
                },
              },
              targetNode: {
                select: {
                  id: true,
                  name: true,
                  nodeKey: true,
                  type: true,
                },
              },
            },
            orderBy: {
              sortOrder: "asc",
            },
          },
          nodes: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
        orderBy: {
          versionNumber: "desc",
        },
        take: 1,
      },
      _count: {
        select: {
          sessions: true,
          triggers: true,
          versions: true,
        },
      },
    },
  });

  if (!chatbot) return null;

  return {
    ...chatbot,
    draftVersion: chatbot.versions[0] ?? null,
  };
}

export async function getChatbotSessionLog({
  chatbotId,
  companyId,
  sessionId,
}: {
  chatbotId: string;
  companyId: string;
  sessionId: string;
}) {
  return prisma.chatbotSession.findFirst({
    where: {
      chatbotId,
      companyId,
      id: sessionId,
    },
    include: {
      chatbot: {
        select: {
          id: true,
          metadata: true,
          name: true,
          status: true,
        },
      },
      contact: {
        select: {
          countryCode: true,
          id: true,
          name: true,
          phoneNumber: true,
        },
      },
      currentNode: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
      events: {
        include: {
          message: {
            select: {
              body: true,
              direction: true,
              errorMessage: true,
              id: true,
              metaMessageId: true,
              status: true,
              toPhoneNumber: true,
            },
          },
          node: {
            select: {
              id: true,
              name: true,
              nodeKey: true,
              type: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      trigger: true,
      version: {
        select: {
          id: true,
          label: true,
          status: true,
          versionNumber: true,
        },
      },
    },
  });
}

export async function getChatbotAnalytics({
  chatbotId,
  companyId,
}: {
  chatbotId: string;
  companyId: string;
}) {
  const chatbot = await prisma.chatbot.findFirst({
    where: {
      companyId,
      id: chatbotId,
      status: {
        not: "ARCHIVED",
      },
    },
    select: {
      description: true,
      id: true,
      name: true,
      status: true,
    },
  });

  if (!chatbot) return null;

  const [sessions, events] = await Promise.all([
    prisma.chatbotSession.findMany({
      where: {
        chatbotId,
        companyId,
      },
      select: {
        completedAt: true,
        contact: {
          select: {
            countryCode: true,
            id: true,
            lifecycleStage: true,
            name: true,
            phoneNumber: true,
          },
        },
        contactId: true,
        currentNode: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        currentNodeId: true,
        id: true,
        lastInteractionAt: true,
        startedAt: true,
        status: true,
      },
      orderBy: {
        lastInteractionAt: "desc",
      },
    }),
    prisma.chatbotSessionEvent.findMany({
      where: {
        chatbotId,
        companyId,
        eventType: {
          in: ["ASSIGNED_AGENT", "MESSAGE_RECEIVED", "MESSAGE_SENT"],
        },
      },
      select: {
        createdAt: true,
        eventType: true,
        node: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        payload: true,
        session: {
          select: {
            contact: {
              select: {
                countryCode: true,
                id: true,
                lifecycleStage: true,
                name: true,
                phoneNumber: true,
              },
            },
            currentNode: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
            id: true,
            lastInteractionAt: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  const totalSessions = sessions.length;
  const contactIds = new Set(
    sessions
      .map((session) => session.contactId)
      .filter((contactId): contactId is string => Boolean(contactId)),
  );
  const completedSessions = sessions.filter(
    (session) => session.status === "COMPLETED",
  );
  const completedContactIds = new Set(
    completedSessions
      .map((session) => session.contactId)
      .filter((contactId): contactId is string => Boolean(contactId)),
  );
  const replyEvents = events.filter(
    (event) => event.eventType === "MESSAGE_RECEIVED",
  );
  const repliedContactIds = new Set(
    replyEvents
      .map((event) => event.session.contact?.id)
      .filter((contactId): contactId is string => Boolean(contactId)),
  );
  const assignedEvents = events.filter(
    (event) => event.eventType === "ASSIGNED_AGENT",
  );
  const assignedContactIds = new Set(
    [
      ...sessions
        .filter((session) => session.status === "HANDED_OFF")
        .map((session) => session.contactId),
      ...assignedEvents.map((event) => event.session.contact?.id),
    ].filter((contactId): contactId is string => Boolean(contactId)),
  );
  const convertedContactIds = new Set(
    sessions
      .filter(
        (session) =>
          session.status === "COMPLETED" ||
          ["CUSTOMER", "QUALIFIED", "OPPORTUNITY"].includes(
            session.contact?.lifecycleStage ?? "",
          ),
      )
      .map((session) => session.contactId)
      .filter((contactId): contactId is string => Boolean(contactId)),
  );
  const buttonClickEvents = replyEvents.filter((event) =>
    ["QUICK_REPLY", "LIST_MENU", "MEDIA_BUTTONS"].includes(
      event.node?.type ?? "",
    ),
  );

  const dropOffBuckets = new Map<
    string,
    {
      count: number;
      nodeId: string | null;
      nodeLabel: string;
      nodeType: string;
    }
  >();

  for (const session of sessions) {
    if (!["ABANDONED", "WAITING_FOR_REPLY"].includes(session.status)) continue;

    const bucketKey = session.currentNodeId ?? "unknown";
    const existing = dropOffBuckets.get(bucketKey);

    dropOffBuckets.set(bucketKey, {
      count: (existing?.count ?? 0) + 1,
      nodeId: session.currentNodeId,
      nodeLabel: session.currentNode?.name ?? "Unknown node",
      nodeType: session.currentNode?.type ?? "UNKNOWN",
    });
  }

  const dropOffNodes = Array.from(dropOffBuckets.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, 10)
    .map((item) => ({
      ...item,
      rateBps: rateBps(item.count, totalSessions),
    }));

  const priceTerms = [
    "amount",
    "cost",
    "kitna",
    "payment",
    "price",
    "rate",
    "rs",
    "rupee",
  ];
  const droppedUsers = uniqueSegmentContacts(
    sessions
      .filter((session) =>
        ["ABANDONED", "WAITING_FOR_REPLY"].includes(session.status),
      )
      .map((session) =>
        segmentContact(
          session,
          session.status === "WAITING_FOR_REPLY"
            ? "Waiting at chatbot node"
            : "Chatbot session abandoned",
        ),
      ),
  );
  const productUsers = uniqueSegmentContacts(
    events
      .filter(
        (event) =>
          event.eventType === "MESSAGE_SENT" &&
          event.node?.type === "CATALOG_PRODUCT_CARD",
      )
      .map((event) =>
        segmentContact(event.session, "Reached product-card path"),
      ),
  );
  const priceIntentUsers = uniqueSegmentContacts(
    replyEvents
      .filter((event) => includesAnyTerm(payloadText(event.payload), priceTerms))
      .map((event) =>
        segmentContact(event.session, "Asked about price or payment"),
      ),
  );
  const salesAssignedUsers = uniqueSegmentContacts([
    ...sessions
      .filter((session) => session.status === "HANDED_OFF")
      .map((session) => segmentContact(session, "Assigned to sales/agent")),
    ...assignedEvents
      .filter((event) =>
        includesAnyTerm(
          String(jsonRecord(event.payload).assignTo ?? ""),
          ["agent", "sales", "support"],
        ),
      )
      .map((event) => segmentContact(event.session, "Assigned by chatbot node")),
  ]);

  return {
    chatbot,
    dropOffNodes,
    metrics: {
      assignedToAgent: assignedContactIds.size,
      buttonClicks: buttonClickEvents.length,
      completedSessions: completedSessions.length,
      completedUsers: completedContactIds.size,
      completionRateBps: rateBps(completedSessions.length, totalSessions),
      convertedLeads: convertedContactIds.size,
      repliedUsers: repliedContactIds.size,
      startedUsers: contactIds.size,
      totalSessions,
    },
    retargeting: {
      droppedUsers,
      priceIntentUsers,
      productUsers,
      salesAssignedUsers,
    },
  };
}

export async function createChatbot({
  actorUserId,
  companyId,
  input,
}: {
  actorUserId: string;
  companyId: string;
  input: CreateChatbotInput;
}) {
  const keywords = parseKeywords(input.keywords);

  return prisma.$transaction(async (tx) => {
    const chatbot = await tx.chatbot.create({
      data: {
        companyId,
        createdByUserId: actorUserId,
        description: input.description?.trim() || null,
        metadata: safeJson({
          phase: "foundation",
          source: "dashboard",
        }),
        name: input.name.trim(),
        updatedByUserId: actorUserId,
      },
    });

    const version = await tx.chatbotVersion.create({
      data: {
        canvas: safeJson({
          edges: [],
          nodes: [
            { key: "start", type: "START", x: 120, y: 160 },
            { key: "end", type: "END", x: 520, y: 160 },
          ],
        }),
        chatbotId: chatbot.id,
        companyId,
        createdByUserId: actorUserId,
        label: "Draft v1",
        versionNumber: 1,
      },
    });

    await tx.chatbotNode.createMany({
      data: [
        {
          chatbotId: chatbot.id,
          companyId,
          config: safeJson({
            description: "Entry point for matched triggers.",
          }),
          name: "Start",
          nodeKey: "start",
          positionX: 120,
          positionY: 160,
          sortOrder: 0,
          type: "START",
          versionId: version.id,
        },
        {
          chatbotId: chatbot.id,
          companyId,
          config: safeJson({
            description: "Conversation completed.",
          }),
          name: "End",
          nodeKey: "end",
          positionX: 520,
          positionY: 160,
          sortOrder: 1,
          type: "END",
          versionId: version.id,
        },
      ],
    });

    if (keywords.length > 0) {
      await tx.chatbotTrigger.createMany({
        data: keywords.map((keyword, index) => ({
          chatbotId: chatbot.id,
          companyId,
          priority: 100 + index,
          type: "KEYWORD",
          value: keyword,
        })),
      });
    }

    return chatbot;
  });
}

export async function updateChatbotStatus({
  actorUserId,
  chatbotId,
  companyId,
  input,
}: {
  actorUserId: string;
  chatbotId: string;
  companyId: string;
  input: UpdateChatbotStatusInput;
}) {
  const chatbot = await prisma.chatbot.findFirst({
    where: {
      companyId,
      id: chatbotId,
    },
    include: {
      versions: {
        include: {
          nodes: true,
        },
        orderBy: {
          versionNumber: "desc",
        },
        take: 1,
      },
    },
  });

  if (!chatbot) {
    throw new Error("Chatbot not found");
  }

  const latestVersion = chatbot.versions[0];

  if (input.status === "PUBLISHED") {
    if (!latestVersion) {
      throw new Error("Create a chatbot version before publishing");
    }

    const hasStart = latestVersion.nodes.some((node) => node.type === "START");
    const hasEnd = latestVersion.nodes.some((node) => node.type === "END");

    if (!hasStart || !hasEnd) {
      throw new Error("Start and End nodes are required before publishing");
    }

    await prisma.chatbotVersion.update({
      where: {
        id: latestVersion.id,
      },
      data: {
        publishedAt: new Date(),
        status: "PUBLISHED",
      },
    });
  }

  return prisma.chatbot.update({
    where: {
      id: chatbot.id,
    },
    data: {
      activeVersionId:
        input.status === "PUBLISHED" ? latestVersion?.id : undefined,
      status: input.status,
      updatedByUserId: actorUserId,
    },
  });
}

export async function updateChatbotFallback({
  actorUserId,
  chatbotId,
  companyId,
  input,
}: {
  actorUserId: string;
  chatbotId: string;
  companyId: string;
  input: UpdateChatbotFallbackInput;
}) {
  const chatbot = await prisma.chatbot.findFirst({
    where: {
      companyId,
      id: chatbotId,
      status: {
        not: "ARCHIVED",
      },
    },
    select: {
      id: true,
      metadata: true,
    },
  });

  if (!chatbot) {
    throw new Error("Chatbot not found");
  }

  const metadata = jsonRecord(chatbot.metadata);
  const fallbackMessage = input.fallbackMessage?.trim() || null;

  return prisma.chatbot.update({
    where: {
      id: chatbot.id,
    },
    data: {
      metadata: safeJson({
        ...metadata,
        fallbackMessage,
      }),
      updatedByUserId: actorUserId,
    },
  });
}

export async function createChatbotTrigger({
  actorUserId,
  chatbotId,
  companyId,
  input,
}: {
  actorUserId: string;
  chatbotId: string;
  companyId: string;
  input: CreateChatbotTriggerInput;
}) {
  const chatbot = await prisma.chatbot.findFirst({
    where: {
      companyId,
      id: chatbotId,
      status: {
        not: "ARCHIVED",
      },
    },
    select: {
      id: true,
    },
  });

  if (!chatbot) {
    throw new Error("Chatbot not found");
  }

  const value = input.value?.trim().toLowerCase() || null;
  const existing = await prisma.chatbotTrigger.findFirst({
    where: {
      chatbotId,
      companyId,
      type: input.type,
      value,
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    throw new Error("This trigger already exists");
  }

  const trigger = await prisma.chatbotTrigger.create({
    data: {
      chatbotId,
      companyId,
      priority: input.priority,
      type: input.type,
      value,
    },
  });

  await prisma.chatbot.update({
    where: {
      id: chatbotId,
    },
    data: {
      updatedByUserId: actorUserId,
    },
  });

  return trigger;
}

export async function deleteChatbotTrigger({
  actorUserId,
  chatbotId,
  companyId,
  triggerId,
}: {
  actorUserId: string;
  chatbotId: string;
  companyId: string;
  triggerId: string;
}) {
  const trigger = await prisma.chatbotTrigger.findFirst({
    where: {
      chatbotId,
      companyId,
      id: triggerId,
    },
    select: {
      id: true,
    },
  });

  if (!trigger) {
    throw new Error("Trigger not found");
  }

  await prisma.chatbotTrigger.delete({
    where: {
      id: trigger.id,
    },
  });

  await prisma.chatbot.update({
    where: {
      id: chatbotId,
    },
    data: {
      updatedByUserId: actorUserId,
    },
  });
}

async function getEditableChatbotVersion({
  chatbotId,
  companyId,
}: {
  chatbotId: string;
  companyId: string;
}) {
  const chatbot = await prisma.chatbot.findFirst({
    where: {
      companyId,
      id: chatbotId,
      status: {
        not: "ARCHIVED",
      },
    },
    include: {
      versions: {
        orderBy: {
          versionNumber: "desc",
        },
        take: 1,
      },
    },
  });

  if (!chatbot) {
    throw new Error("Chatbot not found");
  }

  const version = chatbot.versions[0];

  if (!version || version.status === "ARCHIVED") {
    throw new Error("No editable version found");
  }

  return {
    chatbot,
    version,
  };
}

export async function createChatbotNode({
  actorUserId,
  chatbotId,
  companyId,
  input,
}: {
  actorUserId: string;
  chatbotId: string;
  companyId: string;
  input: CreateChatbotNodeInput;
}) {
  const { version } = await getEditableChatbotVersion({ chatbotId, companyId });
  const nodeCount = await prisma.chatbotNode.count({
    where: {
      companyId,
      versionId: version.id,
    },
  });
  const config = buildNodeConfig(input);
  const positionX = 120 + (nodeCount % 3) * 260;
  const positionY = 160 + Math.floor(nodeCount / 3) * 180;

  const node = await prisma.chatbotNode.create({
    data: {
      chatbotId,
      companyId,
      config: safeJson(config),
      name: input.name.trim(),
      nodeKey: createNodeKey(input.type),
      positionX,
      positionY,
      sortOrder: nodeCount,
      type: input.type,
      versionId: version.id,
    },
  });

  await Promise.all([
    prisma.chatbot.update({
      where: {
        id: chatbotId,
      },
      data: {
        updatedByUserId: actorUserId,
      },
    }),
    prisma.chatbotVersion.update({
      where: {
        id: version.id,
      },
      data: {
        updatedAt: new Date(),
      },
    }),
  ]);

  return node;
}

export async function createChatbotEdge({
  actorUserId,
  chatbotId,
  companyId,
  input,
}: {
  actorUserId: string;
  chatbotId: string;
  companyId: string;
  input: CreateChatbotEdgeInput;
}) {
  if (input.sourceNodeId === input.targetNodeId) {
    throw new Error("Source and target node must be different");
  }

  const { version } = await getEditableChatbotVersion({ chatbotId, companyId });
  const nodes = await prisma.chatbotNode.findMany({
    where: {
      companyId,
      id: {
        in: [input.sourceNodeId, input.targetNodeId],
      },
      versionId: version.id,
    },
    select: {
      id: true,
    },
  });

  if (nodes.length !== 2) {
    throw new Error("Select valid source and target nodes");
  }

  const existingEdge = await prisma.chatbotEdge.findFirst({
    where: {
      sourceNodeId: input.sourceNodeId,
      targetNodeId: input.targetNodeId,
      versionId: version.id,
    },
    select: {
      id: true,
    },
  });

  if (existingEdge) {
    throw new Error("These nodes are already connected");
  }

  const edgeCount = await prisma.chatbotEdge.count({
    where: {
      companyId,
      versionId: version.id,
    },
  });
  const edge = await prisma.chatbotEdge.create({
    data: {
      chatbotId,
      companyId,
      label: input.label?.trim() || null,
      sortOrder: edgeCount,
      sourceNodeId: input.sourceNodeId,
      targetNodeId: input.targetNodeId,
      versionId: version.id,
    },
  });

  await Promise.all([
    prisma.chatbot.update({
      where: {
        id: chatbotId,
      },
      data: {
        updatedByUserId: actorUserId,
      },
    }),
    prisma.chatbotVersion.update({
      where: {
        id: version.id,
      },
      data: {
        updatedAt: new Date(),
      },
    }),
  ]);

  return edge;
}

export async function deleteChatbotNode({
  actorUserId,
  chatbotId,
  companyId,
  nodeId,
}: {
  actorUserId: string;
  chatbotId: string;
  companyId: string;
  nodeId: string;
}) {
  const { version } = await getEditableChatbotVersion({ chatbotId, companyId });
  const node = await prisma.chatbotNode.findFirst({
    where: {
      companyId,
      id: nodeId,
      versionId: version.id,
    },
  });

  if (!node) {
    throw new Error("Node not found");
  }

  if (["START", "END"].includes(node.type)) {
    throw new Error("Start and End nodes cannot be deleted");
  }

  await prisma.chatbotNode.delete({
    where: {
      id: node.id,
    },
  });

  await prisma.chatbot.update({
    where: {
      id: chatbotId,
    },
    data: {
      updatedByUserId: actorUserId,
    },
  });
}

export async function deleteChatbotEdge({
  actorUserId,
  chatbotId,
  companyId,
  edgeId,
}: {
  actorUserId: string;
  chatbotId: string;
  companyId: string;
  edgeId: string;
}) {
  const { version } = await getEditableChatbotVersion({ chatbotId, companyId });
  const edge = await prisma.chatbotEdge.findFirst({
    where: {
      companyId,
      id: edgeId,
      versionId: version.id,
    },
    select: {
      id: true,
    },
  });

  if (!edge) {
    throw new Error("Connection not found");
  }

  await prisma.chatbotEdge.delete({
    where: {
      id: edge.id,
    },
  });

  await prisma.chatbot.update({
    where: {
      id: chatbotId,
    },
    data: {
      updatedByUserId: actorUserId,
    },
  });
}

export async function updateChatbotNodePosition({
  actorUserId,
  chatbotId,
  companyId,
  nodeId,
  positionX,
  positionY,
}: {
  actorUserId: string;
  chatbotId: string;
  companyId: string;
  nodeId: string;
  positionX: number;
  positionY: number;
}) {
  const { version } = await getEditableChatbotVersion({ chatbotId, companyId });
  const node = await prisma.chatbotNode.findFirst({
    where: {
      companyId,
      id: nodeId,
      versionId: version.id,
    },
    select: {
      id: true,
    },
  });

  if (!node) {
    throw new Error("Node not found");
  }

  await prisma.chatbotNode.update({
    where: {
      id: node.id,
    },
    data: {
      positionX,
      positionY,
    },
  });

  await Promise.all([
    prisma.chatbot.update({
      where: {
        id: chatbotId,
      },
      data: {
        updatedByUserId: actorUserId,
      },
    }),
    prisma.chatbotVersion.update({
      where: {
        id: version.id,
      },
      data: {
        updatedAt: new Date(),
      },
    }),
  ]);
}
