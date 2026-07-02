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
      metadata: sanitizeJourneyMetadata(act.metadata) as Record<string, unknown>,
      links: {
        inboxContactId: contactId,
      },
    };
  });
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
            links: { messageId: msg.id, campaignId: msg.campaignId || undefined },
          });
        } else if (ev.status === "READ") {
          events.push({
            id: `msg_ev_read_${ev.id}`,
            type: isCampaign ? "CAMPAIGN_READ" : "MESSAGE_READ",
            source: "WHATSAPP_WEBHOOK",
            title: "Customer read message",
            timestamp: ev.createdAt.toISOString(),
            status: "READ",
            links: { messageId: msg.id, campaignId: msg.campaignId || undefined },
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
            links: { messageId: msg.id, campaignId: msg.campaignId || undefined },
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

    if (session.completedAt) {
      events.push({
        id: `auto_comp_${session.id}`,
        type: "AUTOMATION_COMPLETED",
        source: "AUTOMATION",
        title: "Automation completed",
        timestamp: session.completedAt.toISOString(),
        status: "COMPLETED",
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

        if (step.nodeType === "PAYMENT_LINK") {
          type = "PAYMENT_LINK_CREATED";
          title = "Payment link created";
          description = "Payment link generated by automation.";
        } else if (step.nodeType === "TALLY_LOOKUP") {
          type = "TALLY_LOOKUP";
          title = "Tally lookup completed";
          description = "Lookup: ledger balance / invoice details";
        } else if (step.nodeType === "GOOGLE_SHEET_APPEND_ROW") {
          type = "GOOGLE_SHEET_UPDATED";
          title = "Google Sheet updated";
          description = "Appended row to spreadsheet.";
        } else if (step.nodeType === "AI_REPLY") {
          type = "AI_REPLY_CREATED";
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
          source: "AUTOMATION",
          title,
          description,
          timestamp: step.startedAt.toISOString(),
          status: step.status,
          metadata: sanitizeJourneyMetadata(step.metadata) as Record<string, unknown>,
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
  _companyId: string,
  _contactId: string,
  _dateFilter: { gte?: Date; lte?: Date }
): Promise<CustomerJourneyEvent[]> {
  void _companyId;
  void _contactId;
  void _dateFilter;
  return [];
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
  ] = await Promise.all([
    prisma.message.count({ where: { companyId, contactId, createdAt: dateFilter, direction: "OUTBOUND" } }),
    prisma.message.count({ where: { companyId, contactId, createdAt: dateFilter, direction: "INBOUND" } }),
    prisma.campaignContact.count({ where: { companyId, contactId, createdAt: dateFilter } }),
    prisma.automationSession.count({ where: { companyId, contactId, startedAt: dateFilter } }),
    prisma.automationSession.count({ where: { companyId, contactId, startedAt: dateFilter, status: "COMPLETED" } }),
    prisma.automationSession.count({ where: { companyId, contactId, startedAt: dateFilter, status: "FAILED" } }),
    prisma.automationSession.count({ where: { companyId, contactId, startedAt: dateFilter, handoffAt: { not: null } } }),
  ]);

  return {
    totalEvents: messagesCount + repliesCount + campaignsCount + automationsCount,
    firstSeenAt: contact.createdAt.toISOString(),
    lastActivityAt: contact.updatedAt.toISOString(),
    campaignsReceived: campaignsCount,
    messagesReceived: messagesCount,
    repliesCount,
    automationsStarted: automationsCount,
    automationsCompleted: automationsCompletedCount,
    automationsFailed: automationsFailedCount,
    handoffCount: handoffsCount,
    paymentLinksCreated: 0,
    paymentsCompleted: 0,
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
  const [actEvents, msgEvents, autoEvents, payEvents] = await Promise.all([
    buildContactActivityJourneyEvents(companyId, contactId, dateFilter),
    buildMessageJourneyEvents(companyId, contactId, dateFilter),
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
    ...msgEvents,
    ...autoEvents,
    ...payEvents,
  ];

  // 2. Filter by Type if specified
  if (filters.type && filters.type !== "ALL") {
    allEvents = allEvents.filter((e) => e.type === filters.type);
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
