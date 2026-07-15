import { prisma } from "@/lib/prisma";
import { hashAiInput } from "@/server/ai/provider";

const SECRET_PATTERNS = [
  /\b(sk|pk|rk|whsec|xox[baprs])-[-_a-zA-Z0-9]{12,}\b/g,
  /\b(EAA|EAAG)[a-zA-Z0-9]{20,}\b/g,
  /\b\d{12,19}\b/g,
  /\b[A-Za-z0-9+/]{32,}={0,2}\b/g,
];

function sanitizeText(value: string | null | undefined) {
  if (!value) return "";

  return SECRET_PATTERNS.reduce(
    (text, pattern) => text.replace(pattern, "[redacted]"),
    value,
  ).slice(0, 6_000);
}

function compactJson(value: unknown) {
  if (!value || typeof value !== "object") return null;

  try {
    return sanitizeText(JSON.stringify(value)).slice(0, 1_200);
  } catch {
    return null;
  }
}

export async function assertInboxAiRateLimit({
  companyId,
  userId,
}: {
  companyId: string;
  userId?: string;
}) {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const [summaries, suggestions, translations] = await Promise.all([
    prisma.inboxConversationSummary.count({
      where: { companyId, createdAt: { gte: since } },
    }),
    prisma.inboxAiSuggestion.count({
      where: {
        companyId,
        createdAt: { gte: since },
        ...(userId ? { requestedByUserId: userId } : {}),
      },
    }),
    prisma.inboxMessageTranslation.count({
      where: {
        companyId,
        createdAt: { gte: since },
        ...(userId ? { requestedByUserId: userId } : {}),
      },
    }),
  ]);

  if (summaries + suggestions + translations >= 100) {
    throw new Error("Inbox AI hourly limit reached. Please try again later.");
  }
}

export type InboxAiConversationContext = Awaited<
  ReturnType<typeof buildInboxAiConversationContext>
>;

export async function buildInboxAiConversationContext({
  companyId,
  contactId,
}: {
  companyId: string;
  contactId: string;
}) {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, companyId },
    select: {
      id: true,
      name: true,
      email: true,
      companyName: true,
      countryCode: true,
      phoneNumber: true,
      source: true,
      lifecycleStage: true,
      city: true,
      leadScore: true,
      marketingConsentStatus: true,
      utilityConsentStatus: true,
      inboxStatus: true,
      inboxPriority: true,
      customAttributes: true,
      inboxQueue: {
        select: {
          name: true,
          slug: true,
          approvalRequired: true,
        },
      },
      assignedTo: {
        select: {
          name: true,
          email: true,
        },
      },
      inboxTags: {
        select: {
          tag: {
            select: {
              name: true,
              color: true,
            },
          },
        },
      },
      orders: {
        orderBy: { orderDate: "desc" },
        take: 3,
        select: {
          orderNumber: true,
          source: true,
          currency: true,
          totalAmount: true,
          currentStatus: true,
          orderDate: true,
          items: {
            take: 5,
            select: {
              productNameSnapshot: true,
              quantity: true,
              lineTotalAmount: true,
            },
          },
        },
      },
      tallyCustomerMappings: {
        orderBy: { updatedAt: "desc" },
        take: 2,
        select: {
          tallyLedgerName: true,
          confidence: true,
          lastSyncedAt: true,
        },
      },
    },
  });

  if (!contact) {
    throw new Error("Contact not found");
  }

  const messages = await prisma.message.findMany({
    where: { companyId, contactId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      direction: true,
      status: true,
      body: true,
      metadata: true,
      createdAt: true,
      template: {
        select: {
          name: true,
          category: true,
        },
      },
      campaign: {
        select: {
          name: true,
        },
      },
    },
  });

  const safeContext = {
    contact: {
      id: contact.id,
      name: sanitizeText(contact.name),
      email: sanitizeText(contact.email),
      companyName: sanitizeText(contact.companyName),
      phone: `+${contact.countryCode}${contact.phoneNumber}`,
      source: contact.source,
      lifecycleStage: contact.lifecycleStage,
      city: sanitizeText(contact.city),
      leadScore: contact.leadScore,
      marketingConsentStatus: contact.marketingConsentStatus,
      utilityConsentStatus: contact.utilityConsentStatus,
      inboxStatus: contact.inboxStatus,
      inboxPriority: contact.inboxPriority,
      customAttributes: compactJson(contact.customAttributes),
      tags: contact.inboxTags.map((item) => item.tag.name),
    },
    assignment: {
      queue: contact.inboxQueue?.name ?? null,
      queueSlug: contact.inboxQueue?.slug ?? null,
      approvalRequired: contact.inboxQueue?.approvalRequired ?? false,
      assignedAgent: contact.assignedTo?.name ?? contact.assignedTo?.email ?? null,
    },
    orders: contact.orders.map((order) => ({
      orderNumber: order.orderNumber,
      source: order.source,
      currency: order.currency,
      totalAmount: order.totalAmount.toString(),
      currentStatus: order.currentStatus,
      orderDate: order.orderDate.toISOString(),
      items: order.items.map((item) => ({
        name: sanitizeText(item.productNameSnapshot),
        quantity: item.quantity,
        lineTotalAmount: item.lineTotalAmount.toString(),
      })),
    })),
    tally: contact.tallyCustomerMappings.map((mapping) => ({
      ledgerName: sanitizeText(mapping.tallyLedgerName),
      confidence: mapping.confidence,
      lastSyncedAt: mapping.lastSyncedAt?.toISOString() ?? null,
    })),
    messages: messages.reverse().map((message) => ({
      id: message.id,
      direction: message.direction,
      status: message.status,
      body: sanitizeText(message.body),
      metadata: compactJson(message.metadata),
      templateName: message.template?.name ?? null,
      templateCategory: message.template?.category ?? null,
      campaignName: message.campaign?.name ?? null,
      createdAt: message.createdAt.toISOString(),
    })),
  };

  return {
    ...safeContext,
    inputHash: hashAiInput(safeContext),
  };
}

export async function markInboxAiContextStale({
  companyId,
  contactId,
  reason,
}: {
  companyId: string;
  contactId: string;
  reason: string;
}) {
  await prisma.inboxConversationSummary.updateMany({
    where: {
      companyId,
      contactId,
      staleAt: null,
    },
    data: {
      staleAt: new Date(),
      staleReason: reason,
    },
  });
}
