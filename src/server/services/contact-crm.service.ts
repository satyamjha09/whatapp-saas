import { prisma } from "@/lib/prisma";
import { recordContactActivity } from "@/server/services/contact-activity.service";
import { queueLeadScoreRecalculation } from "@/server/services/lead-scoring.service";

function decimalToNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  const candidate = value as { toNumber?: () => number } | null;
  if (
    candidate &&
    typeof candidate === "object" &&
    typeof candidate.toNumber === "function"
  ) {
    return candidate.toNumber();
  }
  return Number(value ?? 0) || 0;
}

function buildNextRecommendedAction({
  hasOpenTask,
  hasRecentReply,
  isBlocked,
  leadScore,
  marketingConsentStatus,
  openOrderCount,
  optedOutAt,
  readWithoutReplyCount,
}: {
  hasOpenTask: boolean;
  hasRecentReply: boolean;
  isBlocked: boolean;
  leadScore: number;
  marketingConsentStatus: string;
  openOrderCount: number;
  optedOutAt: Date | null;
  readWithoutReplyCount: number;
}) {
  if (isBlocked) {
    return {
      action: "Review blocked contact",
      priority: "High",
      reason: "This customer is blocked, so campaigns and follow-ups should be checked before outreach.",
    };
  }

  if (optedOutAt || marketingConsentStatus === "REVOKED") {
    return {
      action: "Respect opt-out",
      priority: "High",
      reason: "Marketing consent is revoked or the customer opted out. Use only permitted service/utility messages.",
    };
  }

  if (hasOpenTask) {
    return {
      action: "Complete open follow-up task",
      priority: "High",
      reason: "There is already an open campaign follow-up task for this customer.",
    };
  }

  if (hasRecentReply) {
    return {
      action: "Reply from inbox",
      priority: "High",
      reason: "The customer has replied recently, so a human follow-up can convert better than another broadcast.",
    };
  }

  if (openOrderCount > 0) {
    return {
      action: "Send order status update",
      priority: "Medium",
      reason: "The customer has an active order that can be used for a useful WhatsApp update.",
    };
  }

  if (readWithoutReplyCount > 0) {
    return {
      action: "Retarget with a softer CTA",
      priority: "Medium",
      reason: "The customer has read campaign messages but has not replied.",
    };
  }

  if (leadScore >= 70) {
    return {
      action: "Assign to sales",
      priority: "Medium",
      reason: "Lead score is high enough for manual sales attention.",
    };
  }

  return {
    action: "Nurture with approved template",
    priority: "Normal",
    reason: "No urgent issue is visible. Continue with relevant, consent-safe communication.",
  };
}

function latestDate(
  ...values: Array<Date | string | null | undefined>
): Date | null {
  const timestamps = values
    .filter(Boolean)
    .map((value) => new Date(value as Date | string).getTime())
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) return null;

  return new Date(Math.max(...timestamps));
}

export async function getContactCrmProfile({
  companyId,
  contactId,
}: {
  companyId: string;
  contactId: string;
}) {
  const contact = await prisma.contact.findFirst({
    where: {
      id: contactId,
      companyId,
    },
    include: {
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      inboxTags: {
        include: {
          tag: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      _count: {
        select: {
          messages: true,
          inboxNotes: true,
          campaignContacts: true,
          campaignConversionEvents: true,
          campaignFollowUpTasks: true,
          orders: true,
          whatsAppFlowResponses: true,
        },
      },
    },
  });

  if (!contact) return null;

  const [
    inboundMessages,
    outboundMessages,
    readMessages,
    failedMessages,
    recentMessages,
    recentCampaigns,
    recentReplies,
    conversions,
    openTasks,
    orders,
    recentFlowResponses,
    recentActivities,
    recentNotes,
    tallyMappings,
  ] = await Promise.all([
    prisma.message.count({
      where: { companyId, contactId, direction: "INBOUND" },
    }),
    prisma.message.count({
      where: { companyId, contactId, direction: "OUTBOUND" },
    }),
    prisma.message.count({
      where: { companyId, contactId, status: "READ" },
    }),
    prisma.message.count({
      where: { companyId, contactId, status: "FAILED" },
    }),
    prisma.message.findMany({
      where: { companyId, contactId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        body: true,
        createdAt: true,
        direction: true,
        status: true,
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.campaignContact.findMany({
      where: { companyId, contactId },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true,
            template: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.campaignReplyAttribution.findMany({
      where: { companyId, contactId },
      orderBy: { repliedAt: "desc" },
      take: 5,
      select: {
        id: true,
        intent: true,
        replyBodyPreview: true,
        repliedAt: true,
        responseTimeMinutes: true,
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.campaignConversionEvent.findMany({
      where: { companyId, contactId },
      orderBy: { occurredAt: "desc" },
      take: 8,
      select: {
        id: true,
        currency: true,
        note: true,
        occurredAt: true,
        type: true,
        valuePaise: true,
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.campaignFollowUpTask.findMany({
      where: { companyId, contactId, status: "OPEN" },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 5,
      include: {
        assignedToUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.order.findMany({
      where: { companyId, contactId },
      orderBy: { orderDate: "desc" },
      take: 8,
      include: {
        _count: {
          select: {
            items: true,
          },
        },
      },
    }),
    prisma.whatsAppFlowResponse.findMany({
      where: { companyId, contactId },
      orderBy: { submittedAt: "desc" },
      take: 5,
      select: {
        id: true,
        screenId: true,
        status: true,
        submittedAt: true,
        flow: {
          select: {
            id: true,
            name: true,
            useCase: true,
          },
        },
      },
    }),
    prisma.contactActivity.findMany({
      where: { companyId, contactId },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.inboxNote.findMany({
      where: { companyId, contactId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.tallyCustomerMapping.findMany({
      where: { companyId, contactId },
      orderBy: [{ lastSyncedAt: "desc" }, { updatedAt: "desc" }],
      take: 5,
      select: {
        id: true,
        confidence: true,
        lastSyncedAt: true,
        matchSource: true,
        metadata: true,
        tallyCompanyId: true,
        tallyLedgerId: true,
        tallyLedgerName: true,
        updatedAt: true,
      },
    }),
  ]);

  const orderTotalPaise = orders.reduce(
    (sum, order) => sum + Math.round(decimalToNumber(order.totalAmount) * 100),
    0,
  );
  const conversionValuePaise = conversions.reduce(
    (sum, conversion) => sum + (conversion.valuePaise ?? 0),
    0,
  );
  const activeOrders = orders.filter(
    (order) =>
      !["DELIVERED", "CANCELLED", "REFUNDED"].includes(order.currentStatus),
  );
  const openOrderCount = activeOrders.length;
  const outstandingOrderPaise = activeOrders.reduce(
    (sum, order) => sum + Math.round(decimalToNumber(order.totalAmount) * 100),
    0,
  );
  const paymentReceivedPaise = conversions
    .filter((conversion) => conversion.type === "PAYMENT_RECEIVED")
    .reduce((sum, conversion) => sum + (conversion.valuePaise ?? 0), 0);
  const readWithoutReplyCount = Math.max(readMessages - recentReplies.length, 0);
  const appointmentResponses = recentFlowResponses.filter(
    (response) => response.flow.useCase === "APPOINTMENT_BOOKING",
  );
  const lastActivityAt = latestDate(
    contact.lastRepliedAt,
    contact.lastSeenAt,
    contact.lastProfileUpdatedAt,
    contact.updatedAt,
    recentMessages[0]?.createdAt,
    recentActivities[0]?.createdAt,
    recentNotes[0]?.createdAt,
    orders[0]?.updatedAt,
    recentFlowResponses[0]?.submittedAt,
  );

  return {
    ...contact,
    customer360: {
      engagement: {
        failedMessages,
        inboundMessages,
        outboundMessages,
        readMessages,
        recentMessages,
        replies: recentReplies,
        readWithoutReplyCount,
      },
      forms: {
        responses: recentFlowResponses,
        totalResponses: contact._count.whatsAppFlowResponses,
      },
      appointments: {
        responses: appointmentResponses,
        totalResponses: appointmentResponses.length,
      },
      orders: {
        openOrderCount,
        recentOrders: orders.map((order) => ({
          id: order.id,
          itemCount: order._count.items,
          orderDate: order.orderDate,
          orderNumber: order.orderNumber,
          source: order.source,
          status: order.currentStatus,
          totalPaise: Math.round(decimalToNumber(order.totalAmount) * 100),
        })),
        totalOrders: contact._count.orders,
        totalValuePaise: orderTotalPaise,
      },
      campaigns: {
        conversions,
        recentCampaigns,
        totalConversions: contact._count.campaignConversionEvents,
        totalReceived: contact._count.campaignContacts,
      },
      crm: {
        activities: recentActivities,
        assignedTo: contact.assignedTo,
        leadScore: contact.leadScore,
        leadScoreBreakdown: contact.leadScoreBreakdown,
        leadScorePriority: contact.leadScorePriority,
        lifecycleStage: contact.lifecycleStage,
        notes: recentNotes,
        openTasks,
      },
      money: {
        customerLifetimeValuePaise: orderTotalPaise + conversionValuePaise,
        outstandingAmountPaise: outstandingOrderPaise,
        orderValuePaise: orderTotalPaise,
        paymentReceivedPaise,
        trackedConversionValuePaise: conversionValuePaise,
      },
      tally: {
        isMapped: tallyMappings.length > 0,
        mappings: tallyMappings,
        primaryLedger: tallyMappings[0] ?? null,
      },
      lastActivityAt,
      nextRecommendedAction: buildNextRecommendedAction({
        hasOpenTask: openTasks.length > 0,
        hasRecentReply: Boolean(contact.lastRepliedAt),
        isBlocked: contact.isBlocked,
        leadScore: contact.leadScore,
        marketingConsentStatus: contact.marketingConsentStatus,
        openOrderCount,
        optedOutAt: contact.optedOutAt,
        readWithoutReplyCount,
      }),
    },
  };
}

export async function updateContactCrmProfile({
  companyId,
  contactId,
  actorUserId,
  data,
}: {
  companyId: string;
  contactId: string;
  actorUserId?: string | null;
  data: {
    name?: string | null;
    email?: string | null;
    companyName?: string | null;
    externalCustomerId?: string | null;
    lifecycleStage?: string | null;
  };
}) {
  const before = await prisma.contact.findFirst({
    where: {
      id: contactId,
      companyId,
    },
  });

  if (!before) {
    throw new Error("Contact not found");
  }

  const contact = await prisma.contact.update({
    where: {
      id: contactId,
    },
    data: {
      name: data.name ?? before.name,
      email: data.email ?? before.email,
      companyName: data.companyName ?? before.companyName,
      externalCustomerId:
        data.externalCustomerId ?? before.externalCustomerId,
      lifecycleStage: data.lifecycleStage ?? before.lifecycleStage,
      lastProfileUpdatedAt: new Date(),
    },
  });

  await recordContactActivity({
    companyId,
    contactId,
    actorUserId,
    type: "PROFILE_UPDATED",
    title: "Customer profile updated",
    metadata: {
      before: {
        name: before.name,
        email: before.email,
        companyName: before.companyName,
        externalCustomerId: before.externalCustomerId,
        lifecycleStage: before.lifecycleStage,
      },
      after: {
        name: contact.name,
        email: contact.email,
        companyName: contact.companyName,
        externalCustomerId: contact.externalCustomerId,
        lifecycleStage: contact.lifecycleStage,
      },
    },
  });

  await queueLeadScoreRecalculation(companyId, contactId).catch(() => undefined);

  return contact;
}
