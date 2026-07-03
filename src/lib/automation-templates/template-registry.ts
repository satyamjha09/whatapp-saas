import type { AutomationFlowTemplate } from "./template-types";
import {
  PAYMENT_REMINDER_GRAPH,
  LEAD_CAPTURE_GRAPH,
  DEMO_BOOKING_GRAPH,
  ORDER_STATUS_GRAPH,
  CUSTOMER_SUPPORT_GRAPH,
  FEEDBACK_COLLECTION_GRAPH,
  ABANDONED_PAYMENT_FOLLOW_UP_GRAPH,
  TALLY_LEDGER_BALANCE_GRAPH,
  INVOICE_DUE_REMINDER_GRAPH,
} from "./template-graphs";

export const AUTOMATION_FLOW_TEMPLATES: AutomationFlowTemplate[] = [
  {
    slug: "payment-reminder-flow",
    name: "Payment Reminder Flow",
    description: "Send a friendly payment reminder template, handle pay replies with instant Cashfree checkout links, or handoff to support agents.",
    category: "PAYMENTS",
    difficulty: "INTERMEDIATE",
    estimatedSetupMinutes: 10,
    tags: ["Cashfree", "Tally", "Billing", "Reminders"],
    bestFor: ["Collecting unpaid invoice dues automatically", "Minimizing manual collections overhead"],
    requiredIntegrations: [
      { type: "CASHFREE", label: "Cashfree Sandbox/Production Creds", required: true, description: "Required to generate payment links dynamically." },
      { type: "TALLY_CONNECTION", label: "Tally Connector", required: false, description: "Recommended to fetch live outstanding dues values." },
    ],
    requiredWhatsAppTemplates: [
      {
        key: "payment_reminder",
        label: "Payment Reminder template",
        purpose: "Initial message containing details of outstanding invoice balance.",
        category: "UTILITY",
        exampleBody: "Hi {{1}}, your payment of ₹{{2}} for invoice {{3}} is pending. Reply PAY to settle.",
        requiredVariables: [
          { name: "customer_name", description: "Customer Display Name" },
          { name: "amount", description: "Amount Due in INR" },
          { name: "invoice_no", description: "Invoice Serial Number" },
        ],
      },
    ],
    nodesIncluded: ["START", "SEND_TEMPLATE", "WAIT_FOR_REPLY", "CONDITION", "PAYMENT_LINK", "SEND_MESSAGE", "HUMAN_HANDOFF", "END"],
    graph: PAYMENT_REMINDER_GRAPH,
    setupChecklist: [
      { key: "SELECT_WHATSAPP_TEMPLATE_payment_reminder", title: "Select Payment Reminder approved template", description: "Choose a Meta template matching the payment details structure.", required: true, completedBy: "TEMPLATE_MAPPING" },
      { key: "CONNECT_CASHFREE", title: "Configure Cashfree integration credentials", description: "Set active Cashfree gateway to allow link creation.", required: true, completedBy: "INTEGRATION_MAPPING" },
      { key: "RUN_LIVE_TEST", title: "Run a test scenario", description: "Confirm the connection logic and routing work via live test panel.", required: true, completedBy: "TEST_RUN" },
    ],
    exampleConversation: [
      { from: "system", text: "Customer replies with keyword 'payment'" },
      { from: "business", text: "Hi John Doe, your payment of ₹5,200 for invoice INV-1002 is pending. Reply PAY to settle." },
      { from: "customer", text: "PAY" },
      { from: "business", text: "Here is your secure link to pay: https://payments.metawhat.com/l/cf_102938" },
    ],
  },
  {
    slug: "lead-capture-flow",
    name: "Lead Capture Flow",
    description: "Engage incoming contacts with responsive options, send product sheets, or flag new opportunities using customer tag modifiers.",
    category: "LEAD_GENERATION",
    difficulty: "BEGINNER",
    estimatedSetupMinutes: 5,
    tags: ["Sales", "Greeting", "Segmentation"],
    bestFor: ["Routing new customer inquiries", "Qualifying leads without human intervention"],
    requiredIntegrations: [],
    requiredWhatsAppTemplates: [
      {
        key: "pricing_sheet",
        label: "Pricing Sheet template",
        purpose: "Send catalog links and pricing layout details.",
        category: "MARKETING",
        exampleBody: "Here is our updated brochure & pricing information. Let us know if you want to book a call!",
        requiredVariables: [],
      },
    ],
    nodesIncluded: ["START", "SEND_MESSAGE", "QUICK_REPLY", "WAIT_FOR_REPLY", "BUTTON_REPLY_ROUTER", "SEND_TEMPLATE", "HUMAN_HANDOFF", "ADD_TAG", "END"],
    graph: LEAD_CAPTURE_GRAPH,
    setupChecklist: [
      { key: "SELECT_WHATSAPP_TEMPLATE_pricing_sheet", title: "Select Pricing Sheet approved template", description: "Choose a marketing template to send pricing details.", required: true, completedBy: "TEMPLATE_MAPPING" },
      { key: "RUN_LIVE_TEST", title: "Run a test scenario", description: "Ensure quick reply button routing is working.", required: true, completedBy: "TEST_RUN" },
    ],
    exampleConversation: [
      { from: "customer", text: "Hi, I am interested in your software." },
      { from: "business", text: "Welcome to metawhat! How can we help you scale your business today?\n\nSelect:\n1. View Pricing\n2. Request Demo\n3. Talk to Sales" },
      { from: "customer", text: "View Pricing" },
      { from: "business", text: "Here is our updated brochure & pricing information. Let us know if you want to book a call!" },
    ],
  },
  {
    slug: "demo-booking-flow",
    name: "Demo Booking Flow",
    description: "Capture booking slot preferences, append them instantly to Google Sheets, and notify customers using template confirmations.",
    category: "DEMO_BOOKING",
    difficulty: "INTERMEDIATE",
    estimatedSetupMinutes: 12,
    tags: ["Calendar", "Google Sheets", "Meetings"],
    bestFor: ["Scheduling sales walkthroughs", "Storing client notes automatically in sheet rows"],
    requiredIntegrations: [
      { type: "GOOGLE_CONNECTION", label: "Google Drive & Sheets Access", required: true, description: "Required to add rows to target spreadsheets." },
    ],
    requiredWhatsAppTemplates: [
      {
        key: "demo_confirm",
        label: "Demo Confirm template",
        purpose: "Sends a confirmation receipt of the booking request.",
        category: "UTILITY",
        exampleBody: "Thanks! We received your demo slot request. An agent will confirm via calendar invite shortly.",
        requiredVariables: [],
      },
    ],
    nodesIncluded: ["START", "SEND_MESSAGE", "WAIT_FOR_REPLY", "UPDATE_CONTACT_FIELD", "GOOGLE_SHEET_APPEND_ROW", "SEND_TEMPLATE", "END"],
    graph: DEMO_BOOKING_GRAPH,
    setupChecklist: [
      { key: "SELECT_WHATSAPP_TEMPLATE_demo_confirm", title: "Select Demo Confirmation approved template", description: "Select the template validating booking slot logs.", required: true, completedBy: "TEMPLATE_MAPPING" },
      { key: "CONNECT_GOOGLE", title: "Link Google Sheet spreadsheet", description: "Map connection variables to your Google workspace spreadsheet.", required: true, completedBy: "INTEGRATION_MAPPING" },
    ],
    exampleConversation: [
      { from: "customer", text: "demo" },
      { from: "business", text: "Excellent! Please let us know your preferred date and time for the demo." },
      { from: "customer", text: "Next Friday 4 PM" },
      { from: "business", text: "Thanks! We received your demo slot request. An agent will confirm via calendar invite shortly." },
    ],
  },
  {
    slug: "order-status-flow",
    name: "Order Status Flow",
    description: "Resolve tracking inquiries by querying invoice serials from Tally database records on demand.",
    category: "ORDER_STATUS",
    difficulty: "INTERMEDIATE",
    estimatedSetupMinutes: 15,
    tags: ["Tally", "Invoices", "Logistics"],
    bestFor: ["Self-service order status querying", "Eliminating basic status tracking support tickets"],
    requiredIntegrations: [
      { type: "TALLY_CONNECTION", label: "Tally ERP Connector", required: true, description: "Required to look up live status details from ledger database." },
    ],
    requiredWhatsAppTemplates: [],
    nodesIncluded: ["START", "SEND_MESSAGE", "WAIT_FOR_REPLY", "TALLY_LOOKUP", "CONDITION", "SEND_MESSAGE", "HUMAN_HANDOFF", "END"],
    graph: ORDER_STATUS_GRAPH,
    setupChecklist: [
      { key: "CONNECT_TALLY", title: "Link active Tally company", description: "Link the active company database using Tally connector.", required: true, completedBy: "INTEGRATION_MAPPING" },
      { key: "RUN_LIVE_TEST", title: "Test lookup mapping", description: "Provide a mock invoice number and verify Tally returns expected response.", required: true, completedBy: "TEST_RUN" },
    ],
    exampleConversation: [
      { from: "customer", text: "track order" },
      { from: "business", text: "Please reply with your Order or Invoice Number:" },
      { from: "customer", text: "TI-2024-998" },
      { from: "business", text: "Status: Dispatched via BlueDart on 2026-06-29" },
    ],
  },
  {
    slug: "customer-support-flow",
    name: "Customer Support Flow",
    description: "A triage flow that collects initial issue parameters and forwards conversations to appropriate human agent teams.",
    category: "CUSTOMER_SUPPORT",
    difficulty: "BEGINNER",
    estimatedSetupMinutes: 5,
    tags: ["Helpdesk", "Handoff", "Triage"],
    bestFor: ["Structuring inbound support queries", "Filtering out billing requests from product issues"],
    requiredIntegrations: [],
    requiredWhatsAppTemplates: [],
    nodesIncluded: ["START", "QUICK_REPLY", "WAIT_FOR_REPLY", "BUTTON_REPLY_ROUTER", "SEND_MESSAGE", "HUMAN_HANDOFF", "END"],
    graph: CUSTOMER_SUPPORT_GRAPH,
    setupChecklist: [
      { key: "RUN_LIVE_TEST", title: "Run a test scenario", description: "Verify that button routes pass context correctly to human agents.", required: true, completedBy: "TEST_RUN" },
    ],
    exampleConversation: [
      { from: "customer", text: "help" },
      { from: "business", text: "How can we help you today?\n\nSelect:\n1. Billing Issue\n2. Product Help\n3. Talk to Agent" },
      { from: "customer", text: "Product Help" },
      { from: "business", text: "Please reply with a description of the issue you are facing." },
      { from: "customer", text: "My desktop app won't log in." },
      { from: "system", text: "Conversation assigned to agent support queue." },
    ],
  },
  {
    slug: "feedback-collection-flow",
    name: "Feedback Collection Flow",
    description: "Send feedback surveys, branching on score ratings: prompt reviews for promoters and alert agents to resolve detractor issues.",
    category: "FEEDBACK",
    difficulty: "INTERMEDIATE",
    estimatedSetupMinutes: 10,
    tags: ["Feedback", "NPS", "Sheets"],
    bestFor: ["Tracking customer NPS metrics", "Logging user feedback for review analysis"],
    requiredIntegrations: [
      { type: "GOOGLE_CONNECTION", label: "Google Drive & Sheets Access", required: false, description: "Optional but recommended to record scores to spreadsheets." },
    ],
    requiredWhatsAppTemplates: [
      {
        key: "feedback_request",
        label: "Feedback Request template",
        purpose: "Initial message containing numeric rating quick replies.",
        category: "UTILITY",
        exampleBody: "Thanks for choosing us. On a scale of 1-5, how would you rate your experience?",
        requiredVariables: [],
      },
    ],
    nodesIncluded: ["START", "SEND_TEMPLATE", "WAIT_FOR_REPLY", "CONDITION", "SEND_MESSAGE", "GOOGLE_SHEET_APPEND_ROW", "END"],
    graph: FEEDBACK_COLLECTION_GRAPH,
    setupChecklist: [
      { key: "SELECT_WHATSAPP_TEMPLATE_feedback_request", title: "Select Feedback Request approved template", description: "Select the approved survey template.", required: true, completedBy: "TEMPLATE_MAPPING" },
    ],
    exampleConversation: [
      { from: "customer", text: "feedback" },
      { from: "business", text: "Thanks for choosing us. On a scale of 1-5, how would you rate your experience?" },
      { from: "customer", text: "5" },
      { from: "business", text: "Thank you for the positive score! Please share a review on Google if you have a minute." },
    ],
  },
  {
    slug: "abandoned-payment-follow-up-flow",
    name: "Abandoned Payment Follow-up Flow",
    description: "Re-engage shoppers who dropped off during checkout by offering payment assistance or generating direct recovery links.",
    category: "PAYMENTS",
    difficulty: "ADVANCED",
    estimatedSetupMinutes: 15,
    tags: ["Payments", "Checkout", "Handoff"],
    bestFor: ["Recovering dropped shopping cart values", "Clearing checkout bottlenecks"],
    requiredIntegrations: [
      { type: "CASHFREE", label: "Cashfree Sandbox/Production Creds", required: true, description: "Required to generate payment links dynamically." },
    ],
    requiredWhatsAppTemplates: [
      {
        key: "abandoned_payment",
        label: "Abandoned Payment template",
        purpose: "Prompts shopper to complete purchase with options.",
        category: "MARKETING",
        exampleBody: "Hi {{1}}, we noticed you left items in your cart. Settle today or click below to speak with an assistant.",
        requiredVariables: [
          { name: "customer_name", description: "Shopper First Name" },
        ],
      },
    ],
    nodesIncluded: ["START", "SEND_TEMPLATE", "WAIT_FOR_REPLY", "QUICK_REPLY", "WAIT_FOR_REPLY", "BUTTON_REPLY_ROUTER", "PAYMENT_LINK", "SEND_MESSAGE", "HUMAN_HANDOFF", "END"],
    graph: ABANDONED_PAYMENT_FOLLOW_UP_GRAPH,
    setupChecklist: [
      { key: "SELECT_WHATSAPP_TEMPLATE_abandoned_payment", title: "Select Abandoned Payment approved template", description: "Map your cart recovery template.", required: true, completedBy: "TEMPLATE_MAPPING" },
      { key: "CONNECT_CASHFREE", title: "Configure Cashfree integration credentials", description: "Set active Cashfree gateway to allow link creation.", required: true, completedBy: "INTEGRATION_MAPPING" },
    ],
    exampleConversation: [
      { from: "system", text: "Webhook checkout_dropped received" },
      { from: "business", text: "Hi Emma, we noticed you left items in your cart. Settle today or click below to speak with an assistant." },
      { from: "customer", text: "Pay Now" },
      { from: "business", text: "Here is your checkout link: https://payments.metawhat.com/l/recover_829374" },
    ],
  },
  {
    slug: "tally-ledger-balance-flow",
    name: "Tally Ledger Balance Flow",
    description: "Query ledger balances instantly from customer phone records, returning totals or routing users to the accounts team.",
    category: "TALLY",
    difficulty: "INTERMEDIATE",
    estimatedSetupMinutes: 10,
    tags: ["Tally", "Finance", "Outstanding"],
    bestFor: ["Answering outstanding ledger questions", "Letting B2B customers fetch balances directly"],
    requiredIntegrations: [
      { type: "TALLY_CONNECTION", label: "Tally ERP Connector", required: true, description: "Required to look up live status details from ledger database." },
    ],
    requiredWhatsAppTemplates: [],
    nodesIncluded: ["START", "TALLY_LOOKUP", "CONDITION", "SEND_MESSAGE", "HUMAN_HANDOFF", "END"],
    graph: TALLY_LEDGER_BALANCE_GRAPH,
    setupChecklist: [
      { key: "CONNECT_TALLY", title: "Link active Tally company", description: "Link the active company database using Tally connector.", required: true, completedBy: "INTEGRATION_MAPPING" },
    ],
    exampleConversation: [
      { from: "customer", text: "balance" },
      { from: "business", text: "Your outstanding ledger balance is ₹15,400." },
    ],
  },
  {
    slug: "invoice-due-reminder-flow",
    name: "Invoice Due Reminder Flow",
    description: "Trigger automated checks to identify customers with dues, sending reminders with dynamic placeholders.",
    category: "TALLY",
    difficulty: "INTERMEDIATE",
    estimatedSetupMinutes: 10,
    tags: ["Tally", "Invoice", "Reminder"],
    bestFor: ["Proactively querying client dues daily", "Resolving pending collection tickets"],
    requiredIntegrations: [
      { type: "TALLY_CONNECTION", label: "Tally ERP Connector", required: true, description: "Required to look up live status details from ledger database." },
    ],
    requiredWhatsAppTemplates: [
      {
        key: "due_reminder",
        label: "Due Reminder template",
        purpose: "Template sent to remind about unpaid outstanding invoices.",
        category: "UTILITY",
        exampleBody: "Hi {{1}}, you have a pending outstanding balance of ₹{{2}}. Please settle it as soon as possible.",
        requiredVariables: [
          { name: "customer_name", description: "Client Name" },
          { name: "amount", description: "Outstanding Dues Amount" },
        ],
      },
    ],
    nodesIncluded: ["START", "TALLY_LOOKUP", "CONDITION", "SEND_TEMPLATE", "SEND_MESSAGE", "END"],
    graph: INVOICE_DUE_REMINDER_GRAPH,
    setupChecklist: [
      { key: "SELECT_WHATSAPP_TEMPLATE_due_reminder", title: "Select Due Reminder approved template", description: "Map the reminder template to your WhatsApp setup.", required: true, completedBy: "TEMPLATE_MAPPING" },
      { key: "CONNECT_TALLY", title: "Link active Tally company", description: "Link the active company database using Tally connector.", required: true, completedBy: "INTEGRATION_MAPPING" },
    ],
    exampleConversation: [
      { from: "system", text: "Scheduled workflow check starts" },
      { from: "business", text: "Hi Robert, you have a pending outstanding balance of ₹24,000. Please settle it as soon as possible." },
    ],
  },
];

export function getAutomationFlowTemplate(slug: string): AutomationFlowTemplate | null {
  return AUTOMATION_FLOW_TEMPLATES.find((t) => t.slug === slug) ?? null;
}

export function listAutomationFlowTemplates(filters?: {
  search?: string;
  category?: string;
  difficulty?: string;
  integration?: string;
  tag?: string;
}): AutomationFlowTemplate[] {
  let list = AUTOMATION_FLOW_TEMPLATES;

  if (filters?.search) {
    const search = filters.search.toLowerCase();
    list = list.filter(
      (t) =>
        t.name.toLowerCase().includes(search) ||
        t.description.toLowerCase().includes(search) ||
        t.tags.some((tag) => tag.toLowerCase().includes(search)),
    );
  }

  if (filters?.category) {
    list = list.filter((t) => t.category === filters.category);
  }

  if (filters?.difficulty) {
    list = list.filter((t) => t.difficulty === filters.difficulty);
  }

  if (filters?.integration) {
    list = list.filter((t) =>
      t.requiredIntegrations.some((req) => req.type === filters.integration),
    );
  }

  if (filters?.tag) {
    list = list.filter((t) => t.tags.includes(filters.tag!));
  }

  return list;
}
