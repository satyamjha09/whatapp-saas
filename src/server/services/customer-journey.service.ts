import { prisma } from "@/lib/prisma";
import type {
  CustomerJourneyEvent,
  CustomerJourneyEventSource,
  CustomerJourneyEventType,
  CustomerJourneyFilters,
  CustomerJourneyResponse,
  CustomerJourneySummary,
} from "../../lib/customer-journey/journey-types";
import { sanitizeJourneyMetadata } from "../../lib/customer-journey/sanitize-journey-metadata";

export { sanitizeJourneyMetadata };

function formatMoneyFromPaise(amountPaise?: number | null, currency = "INR") {
  if (amountPaise === null || amountPaise === undefined) return "";

  return new Intl.NumberFormat("en-IN", {
    currency,
    style: "currency",
  }).format(amountPaise / 100);
}

function shortText(value?: string | null, maxLength = 120) {
  if (!value) return undefined;
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function metadataRecord(value: unknown) {
  return sanitizeJourneyMetadata(value) as Record<string, unknown>;
}

function statusIsFailure(status?: string | null) {
  return status === "FAILED" || status === "ERROR" || status === "CANCELLED";
}

export async function buildContactActivityJourneyEvents(
  companyId: string,
  contactId: string,
  dateFilter: { gte?: Date; lte?: Date }
): Promise<CustomerJourneyEvent[]> {
  const activities = await prisma.contactActivity.findMany({
    where: {
      companyId,
      contactId,
      createdAt: dateFilter,
    },
    include: {
      actor: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return activities.map((act) => {
    let type: CustomerJourneyEventType = "CUSTOM_EVENT";
    let source: CustomerJourneyEventSource = "CONTACT";

    switch (act.type) {
      case "TAG_ADDED":
        type = "TAG_ADDED";
        source = "CONTACT";
        break;
      case "TAG_REMOVED":
        type = "TAG_REMOVED";
        source = "CONTACT";
        break;
      case "NOTE_CREATED":
      case "NOTE_UPDATED":
      case "NOTE_DELETED":
      case "ASSIGNED":
      case "UNASSIGNED":
      case "STATUS_CHANGED":
      case "PRIORITY_CHANGED":
      case "SNOOZED":
      case "UNSNOOZED":
        source = "INBOX";
        break;
      case "CAMPAIGN_REPLY_ATTRIBUTED":
      case "CAMPAIGN_CONVERSION":
      case "CAMPAIGN_FOLLOW_UP_CREATED":
        source = "CAMPAIGN";
        break;
      case "PROFILE_UPDATED":
      case "OPTED_IN":
      case "OPTED_OUT":
      case "BLOCKED":
      case "UNBLOCKED":
        source = "CONTACT";
        break;
      case "MESSAGE_INBOUND":
        type = "INBOUND_MESSAGE";
        source = "INBOX";
        break;
      case "MESSAGE_OUTBOUND":
        type = "MESSAGE_SENT";
        source = "MESSAGE";
        break;
      default:
        type = "CUSTOM_EVENT";
        source = "CONTACT";
    }

    return {
      id: `act_${act.id}`,
      type,
      source,
      title: act.title,
      description: act.description || undefined,
      timestamp: act.createdAt.toISOString(),
      status: "COMPLETED",
      metadata: metadataRecord({
        activityType: act.type,
        actor: act.actor,
        details: act.metadata,
      }),
      links: {
        inboxContactId: contactId,
      },
    };
  });
}

export async function buildInboxJourneyEvents(
  companyId: string,
  contactId: string,
  dateFilter: { gte?: Date; lte?: Date }
): Promise<CustomerJourneyEvent[]> {
  const [notes, tags] = await Promise.all([
    prisma.inboxNote.findMany({
      where: { companyId, contactId, createdAt: dateFilter },
      include: { author: { select: { email: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.contactInboxTag.findMany({
      where: { companyId, contactId, createdAt: dateFilter },
      include: { tag: { select: { color: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return [
    ...notes.map((note): CustomerJourneyEvent => ({
      id: `note_${note.id}`,
      type: "CUSTOM_EVENT",
      source: "INBOX",
      title: "Agent note added",
      description: shortText(note.body),
      timestamp: note.createdAt.toISOString(),
      status: "COMPLETED",
      metadata: metadataRecord({
        author: note.author,
        noteId: note.id,
        updatedAt: note.updatedAt,
      }),
      links: { inboxContactId: contactId },
    })),
    ...tags.map((contactTag): CustomerJourneyEvent => ({
      id: `tag_${contactTag.id}`,
      type: "TAG_ADDED",
      source: "CONTACT",
      title: "Contact tag added",
      description: contactTag.tag.name,
      timestamp: contactTag.createdAt.toISOString(),
      status: "COMPLETED",
      metadata: metadataRecord({
        color: contactTag.tag.color,
        tagId: contactTag.tagId,
        tagName: contactTag.tag.name,
      }),
      links: { inboxContactId: contactId },
    })),
  ];
}

export async function buildMessageJourneyEvents(
  companyId: string,
  contactId: string,
  dateFilter: { gte?: Date; lte?: Date }
): Promise<CustomerJourneyEvent[]> {
  const messages = await prisma.message.findMany({
    where: {
      companyId,
      contactId,
      createdAt: dateFilter,
    },
    include: {
      template: { select: { name: true } },
      campaign: { select: { name: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const events: CustomerJourneyEvent[] = [];

  for (const msg of messages) {
    const isCampaign = Boolean(msg.campaignId);
    const isOutbound = msg.direction === "OUTBOUND";

    if (isOutbound) {
      if (isCampaign) {
        events.push({
          id: `msg_send_${msg.id}`,
          type: "CAMPAIGN_SENT",
          source: "CAMPAIGN",
          title: "Campaign message sent",
          description: `Campaign: ${msg.campaign?.name || "WhatsApp Campaign"}`,
          timestamp: msg.createdAt.toISOString(),
          status: msg.status,
          links: {
            messageId: msg.id,
            campaignId: msg.campaignId || undefined,
            inboxContactId: contactId,
          },
        });
      } else {
        events.push({
          id: `msg_send_${msg.id}`,
          type: "MESSAGE_SENT",
          source: "MESSAGE",
          title: "Message sent",
          description: msg.template?.name
            ? `Template: ${msg.template.name}`
            : msg.body.slice(0, 120),
          timestamp: msg.createdAt.toISOString(),
          status: msg.status,
          links: {
            messageId: msg.id,
            inboxContactId: contactId,
          },
        });
      }

      // Check status events for delivery / read / fail
      for (const ev of msg.events) {
        if (ev.status === "DELIVERED") {
          events.push({
            id: `msg_ev_del_${ev.id}`,
            type: isCampaign ? "CAMPAIGN_DELIVERED" : "MESSAGE_DELIVERED",
            source: "WHATSAPP_WEBHOOK",
            title: "WhatsApp message delivered",
            timestamp: ev.createdAt.toISOString(),
            status: "DELIVERED",
            links: { messageId: msg.id, campaignId: msg.campaignId || undefined, inboxContactId: contactId },
          });
        } else if (ev.status === "READ") {
          events.push({
            id: `msg_ev_read_${ev.id}`,
            type: isCampaign ? "CAMPAIGN_READ" : "MESSAGE_READ",
            source: "WHATSAPP_WEBHOOK",
            title: "Customer read message",
            timestamp: ev.createdAt.toISOString(),
            status: "READ",
            links: { messageId: msg.id, campaignId: msg.campaignId || undefined, inboxContactId: contactId },
          });
        } else if (ev.status === "FAILED") {
          events.push({
            id: `msg_ev_fail_${ev.id}`,
            type: isCampaign ? "CAMPAIGN_FAILED" : "MESSAGE_FAILED",
            source: "WHATSAPP_WEBHOOK",
            title: "Message failed",
            description: msg.errorMessage || "Delivery failed",
            timestamp: ev.createdAt.toISOString(),
            status: "FAILED",
            metadata: metadataRecord({
              errorCode: msg.errorCode,
              errorMessage: msg.errorMessage,
            }),
            links: { messageId: msg.id, campaignId: msg.campaignId || undefined, inboxContactId: contactId },
          });
        }
      }
    } else {
      // Inbound message
      events.push({
        id: `msg_inbound_${msg.id}`,
        type: "INBOUND_MESSAGE",
        source: "INBOX",
        title: "Customer replied",
        description: msg.body.slice(0, 120),
        timestamp: msg.createdAt.toISOString(),
        status: "RECEIVED",
        links: {
          messageId: msg.id,
          inboxContactId: contactId,
        },
      });
    }
  }

  return events;
}

export async function buildCampaignJourneyEvents(
  companyId: string,
  contactId: string,
  dateFilter: { gte?: Date; lte?: Date }
): Promise<CustomerJourneyEvent[]> {
  const [replyAttributions, conversions, followUpTasks] = await Promise.all([
    prisma.campaignReplyAttribution.findMany({
      where: { companyId, contactId, repliedAt: dateFilter },
      include: { campaign: { select: { name: true } } },
      orderBy: { repliedAt: "desc" },
      take: 100,
    }),
    prisma.campaignConversionEvent.findMany({
      where: {
        companyId,
        contactId,
        occurredAt: dateFilter,
        NOT: { type: "PAYMENT_RECEIVED" },
      },
      include: { campaign: { select: { name: true } } },
      orderBy: { occurredAt: "desc" },
      take: 100,
    }),
    prisma.campaignFollowUpTask.findMany({
      where: { companyId, contactId, createdAt: dateFilter },
      include: { campaign: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const events: CustomerJourneyEvent[] = [];

  replyAttributions.forEach((reply) => {
    events.push({
      id: `campaign_reply_${reply.id}`,
      type: reply.intent !== "UNKNOWN" ? "BUTTON_CLICKED" : "INBOUND_MESSAGE",
      source: "CAMPAIGN",
      title: "Customer replied to campaign",
      description: shortText(
        reply.replyBodyPreview ||
          reply.replyBody ||
          `Campaign: ${reply.campaign.name}`,
      ),
      timestamp: reply.repliedAt.toISOString(),
      status: reply.status,
      metadata: metadataRecord({
        autoClassified: reply.autoClassified,
        intent: reply.intent,
        responseTimeMinutes: reply.responseTimeMinutes,
        source: reply.source,
        details: reply.metadata,
      }),
      links: {
        campaignId: reply.campaignId,
        inboxContactId: contactId,
        messageId: reply.messageId,
      },
    });
  });

  conversions.forEach((conversion) => {
    const isWon = conversion.type === "LEAD_WON";
    const isLost = conversion.type === "LEAD_LOST";

    events.push({
      id: `campaign_conversion_${conversion.id}`,
      type: isWon || isLost ? "LEAD_SCORE_CHANGED" : "CUSTOM_EVENT",
      source: "CAMPAIGN",
      title: isWon
        ? "Customer converted"
        : isLost
          ? "Lead marked lost"
          : "Campaign conversion recorded",
      description:
        conversion.note ||
        [
          `Campaign: ${conversion.campaign.name}`,
          conversion.valuePaise ? `Value: ${formatMoneyFromPaise(conversion.valuePaise, conversion.currency)}` : "",
        ].filter(Boolean).join(" · "),
      timestamp: conversion.occurredAt.toISOString(),
      status: "COMPLETED",
      metadata: metadataRecord({
        conversionType: conversion.type,
        currency: conversion.currency,
        valuePaise: conversion.valuePaise,
        details: conversion.metadata,
      }),
      links: {
        campaignId: conversion.campaignId,
        inboxContactId: contactId,
        messageId: conversion.messageId || undefined,
      },
    });
  });

  followUpTasks.forEach((task) => {
    events.push({
      id: `campaign_followup_${task.id}`,
      type: "HUMAN_HANDOFF",
      source: "INBOX",
      title: "Campaign follow-up created",
      description: shortText(task.description || task.title),
      timestamp: task.createdAt.toISOString(),
      status: task.status,
      metadata: metadataRecord({
        campaignName: task.campaign.name,
        dueAt: task.dueAt,
        priority: task.priority,
        details: task.metadata,
      }),
      links: {
        campaignId: task.campaignId,
        inboxContactId: contactId,
      },
    });
  });

  return events;
}

export async function buildAutomationJourneyEvents(
  companyId: string,
  contactId: string,
  dateFilter: { gte?: Date; lte?: Date }
): Promise<CustomerJourneyEvent[]> {
  const sessions = await prisma.automationSession.findMany({
    where: {
      companyId,
      contactId,
      startedAt: dateFilter,
    },
    include: {
      flow: { select: { name: true } },
      flowVersion: { select: { versionNumber: true } },
      executions: {
        include: {
          steps: { orderBy: { startedAt: "asc" } },
        },
        orderBy: { startedAt: "asc" },
      },
    },
    orderBy: { startedAt: "desc" },
    take: 100,
  });

  const events: CustomerJourneyEvent[] = [];

  for (const session of sessions) {
    const flowName = session.flow?.name || "Automation Flow";
    const verNum = session.flowVersion?.versionNumber || 1;

    events.push({
      id: `auto_start_${session.id}`,
      type: "AUTOMATION_STARTED",
      source: "AUTOMATION",
      title: "Automation started",
      description: `Flow: ${flowName}, Version ${verNum}`,
      timestamp: session.startedAt.toISOString(),
      status: session.status,
      metadata: metadataRecord({
        currentNodeId: session.currentNodeId,
        waitingNodeId: session.waitingNodeId,
      }),
      links: {
        automationFlowId: session.flowId,
        automationExecutionId: session.lastExecutionId || undefined,
      },
    });

    if (session.handoffAt) {
      events.push({
        id: `auto_handoff_${session.id}`,
        type: "HUMAN_HANDOFF",
        source: "AUTOMATION",
        title: "Human handoff requested",
        description: "Conversation moved to agent inbox.",
        timestamp: session.handoffAt.toISOString(),
        status: "HANDOFF",
        links: {
          automationFlowId: session.flowId,
          inboxContactId: contactId,
        },
      });
    }

    if (session.status === "WAITING" && session.waitingNodeId) {
      events.push({
        id: `auto_wait_${session.id}`,
        type: "AUTOMATION_WAITING",
        source: "AUTOMATION",
        title: "Automation waiting for reply",
        description: `Waiting at node ${session.waitingNodeId}`,
        timestamp: session.updatedAt.toISOString(),
        status: "WAITING",
        links: {
          automationFlowId: session.flowId,
          automationExecutionId: session.lastExecutionId || undefined,
          inboxContactId: contactId,
        },
      });
    }

    if (session.completedAt) {
      events.push({
        id: `auto_comp_${session.id}`,
        type: "AUTOMATION_COMPLETED",
        source: "AUTOMATION",
        title: "Automation completed",
        timestamp: session.completedAt.toISOString(),
      status: "COMPLETED",
      metadata: metadataRecord({ endedAt: session.endedAt }),
      links: {
          automationFlowId: session.flowId,
        },
      });
    } else if (session.failedAt) {
      events.push({
        id: `auto_fail_${session.id}`,
        type: "AUTOMATION_FAILED",
        source: "AUTOMATION",
        title: "Automation failed",
      description: "Execution stopped due to error.",
      timestamp: session.failedAt.toISOString(),
      status: "FAILED",
      metadata: metadataRecord({ endedAt: session.endedAt }),
      links: {
          automationFlowId: session.flowId,
        },
      });
    }

    // Step executions
    for (const exec of session.executions) {
      for (const step of exec.steps) {
        let type: CustomerJourneyEventType = "AUTOMATION_NODE_EXECUTED";
        let title = "Automation step completed";
        let description = `Node: ${step.nodeType}`;
        let source: CustomerJourneyEventSource = "AUTOMATION";

        if (step.nodeType === "PAYMENT_LINK") {
          type = "PAYMENT_LINK_CREATED";
          source = "PAYMENT";
          title = "Payment link created";
          description = "Payment link generated by automation.";
        } else if (step.nodeType === "TALLY_LOOKUP") {
          type = "TALLY_LOOKUP";
          source = "TALLY";
          title = "Tally lookup completed";
          description = "Lookup: ledger balance / invoice details";
        } else if (step.nodeType === "GOOGLE_SHEET_APPEND_ROW") {
          type = "GOOGLE_SHEET_UPDATED";
          source = "GOOGLE_SHEET";
          title = "Google Sheet updated";
          description = "Appended row to spreadsheet.";
        } else if (step.nodeType === "AI_REPLY") {
          type = "AI_REPLY_CREATED";
          source = "AI";
          title = "AI reply generated";
          description = "Smart AI reply generated for customer.";
        } else if (step.nodeType === "HUMAN_HANDOFF") {
          type = "HUMAN_HANDOFF";
          title = "Human handoff requested";
          description = "Conversation moved to agent inbox.";
        }

        events.push({
          id: `auto_step_${step.id}`,
          type,
          source,
          title,
          description: step.errorMessage ? shortText(step.errorMessage) : description,
          timestamp: step.startedAt.toISOString(),
          status: step.status,
          metadata: metadataRecord({
            durationMs: step.durationMs,
            errorMessage: step.errorMessage,
            input: step.input,
            metadata: step.metadata,
            output: step.output,
            retryCount: step.retryCount,
            sourceHandle: step.sourceHandle,
            targetNodeId: step.targetNodeId,
          }),
          links: {
            automationFlowId: session.flowId,
            automationExecutionId: exec.id,
          },
        });
      }
    }
  }

  return events;
}

export async function buildPaymentJourneyEvents(
  companyId: string,
  contactId: string,
  dateFilter: { gte?: Date; lte?: Date }
): Promise<CustomerJourneyEvent[]> {
  const paymentConversions = await prisma.campaignConversionEvent.findMany({
    where: {
      companyId,
      contactId,
      occurredAt: dateFilter,
      type: "PAYMENT_RECEIVED",
    },
    include: {
      campaign: { select: { name: true } },
    },
    orderBy: { occurredAt: "desc" },
    take: 100,
  });

  return paymentConversions.map((conversion) => ({
    id: `payment_conversion_${conversion.id}`,
    type: "PAYMENT_COMPLETED",
    source: "PAYMENT",
    title: "Payment completed",
    description:
      conversion.note ||
      [
        conversion.campaign.name,
        conversion.valuePaise ? formatMoneyFromPaise(conversion.valuePaise, conversion.currency) : "",
      ].filter(Boolean).join(" · "),
    timestamp: conversion.occurredAt.toISOString(),
    status: "COMPLETED",
    metadata: metadataRecord({
      campaignId: conversion.campaignId,
      conversionType: conversion.type,
      currency: conversion.currency,
      valuePaise: conversion.valuePaise,
      details: conversion.metadata,
    }),
    links: {
      campaignId: conversion.campaignId,
      inboxContactId: contactId,
      paymentId: conversion.id,
    },
  }));
}

export async function getCustomerJourneySummary(
  companyId: string,
  contactId: string,
  filters: CustomerJourneyFilters = {}
): Promise<CustomerJourneySummary> {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, companyId },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      leadScore: true,
      inboxStatus: true,
    },
  });

  if (!contact) {
    throw new Error(`Contact with ID ${contactId} not found.`);
  }

  const startDateFilter = filters.startDate ? new Date(filters.startDate) : new Date(Date.now() - 90 * 86400 * 1000);
  const endDateFilter = filters.endDate ? new Date(filters.endDate) : new Date();

  const dateFilter = { gte: startDateFilter, lte: endDateFilter };

  const [
    messagesCount,
    repliesCount,
    campaignsCount,
    automationsCount,
    automationsCompletedCount,
    automationsFailedCount,
    handoffsCount,
    paymentLinksCreatedCount,
    paymentsCompletedCount,
    contactActivitiesCount,
    inboxNotesCount,
  ] = await Promise.all([
    prisma.message.count({ where: { companyId, contactId, createdAt: dateFilter, direction: "OUTBOUND" } }),
    prisma.message.count({ where: { companyId, contactId, createdAt: dateFilter, direction: "INBOUND" } }),
    prisma.campaignContact.count({ where: { companyId, contactId, createdAt: dateFilter } }),
    prisma.automationSession.count({ where: { companyId, contactId, startedAt: dateFilter } }),
    prisma.automationSession.count({ where: { companyId, contactId, startedAt: dateFilter, status: "COMPLETED" } }),
    prisma.automationSession.count({ where: { companyId, contactId, startedAt: dateFilter, status: "FAILED" } }),
    prisma.automationSession.count({ where: { companyId, contactId, startedAt: dateFilter, handoffAt: { not: null } } }),
    prisma.automationExecutionStep.count({
      where: {
        companyId,
        nodeType: "PAYMENT_LINK",
        startedAt: dateFilter,
        execution: {
          session: {
            is: { contactId },
          },
        },
      },
    }),
    prisma.campaignConversionEvent.count({ where: { companyId, contactId, occurredAt: dateFilter, type: "PAYMENT_RECEIVED" } }),
    prisma.contactActivity.count({ where: { companyId, contactId, createdAt: dateFilter } }),
    prisma.inboxNote.count({ where: { companyId, contactId, createdAt: dateFilter } }),
  ]);

  return {
    totalEvents:
      messagesCount +
      repliesCount +
      campaignsCount +
      automationsCount +
      paymentLinksCreatedCount +
      paymentsCompletedCount +
      contactActivitiesCount +
      inboxNotesCount,
    firstSeenAt: contact.createdAt.toISOString(),
    lastActivityAt: contact.updatedAt.toISOString(),
    campaignsReceived: campaignsCount,
    messagesReceived: messagesCount,
    repliesCount,
    automationsStarted: automationsCount,
    automationsCompleted: automationsCompletedCount,
    automationsFailed: automationsFailedCount,
    handoffCount: handoffsCount,
    paymentLinksCreated: paymentLinksCreatedCount,
    paymentsCompleted: paymentsCompletedCount,
    currentLeadScore: contact.leadScore ?? 0,
    currentInboxStatus: contact.inboxStatus,
  };
}

export async function getCustomerJourney(
  companyId: string,
  contactId: string,
  filters: CustomerJourneyFilters = {}
): Promise<CustomerJourneyResponse> {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, companyId },
  });

  if (!contact) {
    throw new Error(`Contact with ID ${contactId} not found.`);
  }

  const startDateFilter = filters.startDate ? new Date(filters.startDate) : new Date(Date.now() - 90 * 86400 * 1000);
  const endDateFilter = filters.endDate ? new Date(filters.endDate) : new Date();
  const dateFilter = { gte: startDateFilter, lte: endDateFilter };

  // 1. Gather events from all subsystems
  const [actEvents, inboxEvents, msgEvents, campaignEvents, autoEvents, payEvents] = await Promise.all([
    buildContactActivityJourneyEvents(companyId, contactId, dateFilter),
    buildInboxJourneyEvents(companyId, contactId, dateFilter),
    buildMessageJourneyEvents(companyId, contactId, dateFilter),
    buildCampaignJourneyEvents(companyId, contactId, dateFilter),
    buildAutomationJourneyEvents(companyId, contactId, dateFilter),
    buildPaymentJourneyEvents(companyId, contactId, dateFilter),
  ]);

  // Add initial creation event
  const contactCreatedEvent: CustomerJourneyEvent = {
    id: `contact_created_${contact.id}`,
    type: "CONTACT_CREATED",
    source: "CONTACT",
    title: "Contact created",
    description: "Customer was added to TallyKonnect.",
    timestamp: contact.createdAt.toISOString(),
    status: "COMPLETED",
    links: { inboxContactId: contact.id },
  };

  let allEvents: CustomerJourneyEvent[] = [
    contactCreatedEvent,
    ...actEvents,
    ...inboxEvents,
    ...msgEvents,
    ...campaignEvents,
    ...autoEvents,
    ...payEvents,
  ];

  // 2. Filter by Type if specified
  if (filters.type && filters.type !== "ALL") {
    if (filters.type === "ERRORS") {
      allEvents = allEvents.filter((event) =>
        event.type.endsWith("_FAILED") || statusIsFailure(event.status),
      );
    } else {
      allEvents = allEvents.filter((e) => e.type === filters.type);
    }
  }

  // 3. Filter by Source if specified
  if (filters.source && filters.source !== "ALL") {
    allEvents = allEvents.filter((e) => e.source === filters.source);
  }

  // 4. Sort chronologically
  const isAsc = filters.sortOrder === "asc";
  allEvents.sort((a, b) => {
    const tA = new Date(a.timestamp).getTime();
    const tB = new Date(b.timestamp).getTime();
    return isAsc ? tA - tB : tB - tA;
  });

  // 5. Pagination
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 50;
  const total = allEvents.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const paginatedEvents = allEvents.slice((page - 1) * pageSize, page * pageSize);

  // 6. Get summary
  const summary = await getCustomerJourneySummary(companyId, contactId, filters);

  return {
    summary,
    events: paginatedEvents,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  };
}
