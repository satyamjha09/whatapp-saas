export type CustomerJourneyEventType =
  | "CONTACT_CREATED"
  | "CONTACT_IMPORTED"
  | "TAG_ADDED"
  | "TAG_REMOVED"
  | "LEAD_SCORE_CHANGED"
  | "CAMPAIGN_SENT"
  | "CAMPAIGN_DELIVERED"
  | "CAMPAIGN_READ"
  | "CAMPAIGN_FAILED"
  | "MESSAGE_SENT"
  | "MESSAGE_DELIVERED"
  | "MESSAGE_READ"
  | "MESSAGE_FAILED"
  | "INBOUND_MESSAGE"
  | "BUTTON_CLICKED"
  | "LIST_ITEM_SELECTED"
  | "AUTOMATION_STARTED"
  | "AUTOMATION_NODE_EXECUTED"
  | "AUTOMATION_WAITING"
  | "AUTOMATION_COMPLETED"
  | "AUTOMATION_FAILED"
  | "HUMAN_HANDOFF"
  | "AGENT_REPLY"
  | "PAYMENT_LINK_CREATED"
  | "PAYMENT_COMPLETED"
  | "PAYMENT_FAILED"
  | "TALLY_LOOKUP"
  | "GOOGLE_SHEET_UPDATED"
  | "AI_REPLY_CREATED"
  | "CUSTOM_EVENT";

export type CustomerJourneyEventSource =
  | "CONTACT"
  | "CAMPAIGN"
  | "MESSAGE"
  | "WHATSAPP_WEBHOOK"
  | "AUTOMATION"
  | "PAYMENT"
  | "TALLY"
  | "GOOGLE_SHEET"
  | "AI"
  | "INBOX"
  | "SYSTEM";

export type CustomerJourneyEventLink = {
  messageId?: string;
  campaignId?: string;
  automationFlowId?: string;
  automationExecutionId?: string;
  paymentId?: string;
  inboxContactId?: string;
};

export type CustomerJourneyEvent = {
  id: string;
  type: CustomerJourneyEventType;
  source: CustomerJourneyEventSource;
  title: string;
  description?: string;
  timestamp: string; // ISO string
  status?: string;
  metadata?: Record<string, unknown>;
  links?: CustomerJourneyEventLink;
};

export type CustomerJourneySummary = {
  totalEvents: number;
  firstSeenAt?: string;
  lastActivityAt?: string;
  campaignsReceived: number;
  messagesReceived: number;
  repliesCount: number;
  automationsStarted: number;
  automationsCompleted: number;
  automationsFailed: number;
  handoffCount: number;
  paymentLinksCreated: number;
  paymentsCompleted: number;
  currentLeadScore?: number;
  currentInboxStatus?: string;
};

export type CustomerJourneyFilters = {
  startDate?: string;
  endDate?: string;
  type?: string;
  source?: string;
  page?: number;
  pageSize?: number;
  sortOrder?: "asc" | "desc";
};

export type CustomerJourneyResponse = {
  summary: CustomerJourneySummary;
  events: CustomerJourneyEvent[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
