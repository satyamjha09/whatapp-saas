import type { AutomationGraph } from "../automation-builder/types";

export const PAYMENT_REMINDER_GRAPH: AutomationGraph = {
  version: 1,
  nodes: [
    {
      id: "node_start",
      type: "START",
      position: { x: 100, y: 200 },
      data: {
        label: "Trigger: Keyword",
        triggerType: "KEYWORD",
        keywords: ["payment", "pay", "dues"],
      },
    },
    {
      id: "node_send_template",
      type: "SEND_TEMPLATE",
      position: { x: 350, y: 200 },
      data: {
        label: "Send Payment Reminder",
        templateId: "{{WHATSAPP_TEMPLATE_PAYMENT_REMINDER}}",
        templateName: "payment_reminder",
        languageCode: "en_US",
        headerVariableMappings: [],
        bodyVariableMappings: [
          {
            variableName: "customer_name",
            component: "BODY",
            index: 1,
            sourceType: "CONTACT_FIELD",
            sourceValue: "name",
          },
          {
            variableName: "amount",
            component: "BODY",
            index: 2,
            sourceType: "CUSTOM_ATTRIBUTE",
            sourceValue: "outstanding_amount",
          },
        ],
        buttonVariableMappings: [],
      },
    },
    {
      id: "node_wait_reply",
      type: "WAIT_FOR_REPLY",
      position: { x: 600, y: 200 },
      data: {
        label: "Wait for Reply",
        timeoutMinutes: 60,
        saveReplyAs: "payment_reply",
        acceptedReplyType: "ANY",
      },
    },
    {
      id: "node_check_pay",
      type: "CONDITION",
      position: { x: 850, y: 200 },
      data: {
        label: "Replies PAY?",
        variable: "payment_reply",
        operator: "EQUALS",
        value: "PAY",
      },
    },
    {
      id: "node_create_link",
      type: "PAYMENT_LINK",
      position: { x: 1100, y: 100 },
      data: {
        label: "Create Cashfree Link",
        provider: "CASHFREE",
        amountSource: {
          sourceType: "CUSTOM_ATTRIBUTE",
          sourceValue: "outstanding_amount",
        },
        currency: "INR",
        customerNameSource: {
          sourceType: "CONTACT_FIELD",
          sourceValue: "name",
        },
        customerPhoneSource: {
          sourceType: "CONTACT_FIELD",
          sourceValue: "phone",
        },
        purpose: "Invoice Settlement",
        savePaymentLinkAs: "payment_link",
        expiryMinutes: 1440,
      },
    },
    {
      id: "node_send_link",
      type: "SEND_MESSAGE",
      position: { x: 1350, y: 100 },
      data: {
        label: "Send Payment Link",
        messageText: "Here is your secure link to pay: {{payment_link}}",
      },
    },
    {
      id: "node_handoff",
      type: "HUMAN_HANDOFF",
      position: { x: 1100, y: 320 },
      data: {
        label: "Escalate to Agent",
      },
    },
    {
      id: "node_end",
      type: "END",
      position: { x: 1600, y: 200 },
      data: {
        label: "Finish Flow",
      },
    },
  ],
  edges: [
    {
      id: "edge_1",
      source: "node_start",
      target: "node_send_template",
    },
    {
      id: "edge_2",
      source: "node_send_template",
      target: "node_wait_reply",
    },
    {
      id: "edge_3",
      source: "node_wait_reply",
      target: "node_check_pay",
    },
    {
      id: "edge_4",
      source: "node_check_pay",
      target: "node_create_link",
      sourceHandle: "true",
      label: "Yes",
    },
    {
      id: "edge_5",
      source: "node_check_pay",
      target: "node_handoff",
      sourceHandle: "false",
      label: "No / Timeout",
    },
    {
      id: "edge_6",
      source: "node_create_link",
      target: "node_send_link",
    },
    {
      id: "edge_7",
      source: "node_send_link",
      target: "node_end",
    },
    {
      id: "edge_8",
      source: "node_handoff",
      target: "node_end",
    },
  ],
};

export const LEAD_CAPTURE_GRAPH: AutomationGraph = {
  version: 1,
  nodes: [
    {
      id: "node_start",
      type: "START",
      position: { x: 100, y: 250 },
      data: {
        label: "Trigger: Lead Keywords",
        triggerType: "KEYWORD",
        keywords: ["hi", "hello", "interested"],
      },
    },
    {
      id: "node_welcome",
      type: "SEND_MESSAGE",
      position: { x: 320, y: 250 },
      data: {
        label: "Welcome Message",
        messageText: "Welcome to metawhat! How can we help you scale your business today?",
      },
    },
    {
      id: "node_options",
      type: "QUICK_REPLY",
      position: { x: 540, y: 250 },
      data: {
        label: "Select Path",
        bodyText: "Please choose from the options below:",
        buttons: [
          { id: "pricing", label: "View Pricing" },
          { id: "demo", label: "Request Demo" },
          { id: "agent", label: "Talk to Sales" },
        ],
      },
    },
    {
      id: "node_wait",
      type: "WAIT_FOR_REPLY",
      position: { x: 760, y: 250 },
      data: {
        label: "Wait for Choice",
        timeoutMinutes: 30,
        saveReplyAs: "lead_choice",
        acceptedReplyType: "BUTTON",
      },
    },
    {
      id: "node_router",
      type: "BUTTON_REPLY_ROUTER",
      position: { x: 980, y: 250 },
      data: {
        label: "Route Lead",
        sourceNodeId: "node_wait",
        routes: [
          { buttonId: "pricing", buttonLabel: "View Pricing" },
          { buttonId: "demo", buttonLabel: "Request Demo" },
          { buttonId: "agent", buttonLabel: "Talk to Sales" },
        ],
        fallbackEnabled: true,
      },
    },
    {
      id: "node_send_pricing",
      type: "SEND_TEMPLATE",
      position: { x: 1220, y: 100 },
      data: {
        label: "Send Pricing Sheet",
        templateId: "{{WHATSAPP_TEMPLATE_PRICING}}",
        templateName: "pricing_sheet",
        languageCode: "en_US",
        headerVariableMappings: [],
        bodyVariableMappings: [],
        buttonVariableMappings: [],
      },
    },
    {
      id: "node_ask_demo",
      type: "SEND_MESSAGE",
      position: { x: 1220, y: 250 },
      data: {
        label: "Prompt Demo Details",
        messageText: "Sure! Please reply with your business name & email so we can schedule a session.",
      },
    },
    {
      id: "node_handoff",
      type: "HUMAN_HANDOFF",
      position: { x: 1220, y: 400 },
      data: {
        label: "Sales Handoff",
      },
    },
    {
      id: "node_tag_lead",
      type: "ADD_TAG",
      position: { x: 1480, y: 250 },
      data: {
        label: "Tag: New Lead",
      },
    },
    {
      id: "node_end",
      type: "END",
      position: { x: 1700, y: 250 },
      data: {
        label: "Done",
      },
    },
  ],
  edges: [
    { id: "e1", source: "node_start", target: "node_welcome" },
    { id: "e2", source: "node_welcome", target: "node_options" },
    { id: "e3", source: "node_options", target: "node_wait" },
    { id: "e4", source: "node_wait", target: "node_router" },
    { id: "e5", source: "node_router", target: "node_send_pricing", sourceHandle: "pricing" },
    { id: "e6", source: "node_router", target: "node_ask_demo", sourceHandle: "demo" },
    { id: "e7", source: "node_router", target: "node_handoff", sourceHandle: "agent" },
    { id: "e8", source: "node_router", target: "node_handoff", sourceHandle: "fallback" },
    { id: "e9", source: "node_send_pricing", target: "node_tag_lead" },
    { id: "e10", source: "node_ask_demo", target: "node_tag_lead" },
    { id: "e11", source: "node_handoff", target: "node_tag_lead" },
    { id: "e12", source: "node_tag_lead", target: "node_end" },
  ],
};

export const DEMO_BOOKING_GRAPH: AutomationGraph = {
  version: 1,
  nodes: [
    {
      id: "node_start",
      type: "START",
      position: { x: 100, y: 200 },
      data: {
        label: "Trigger: Keyword demo",
        triggerType: "KEYWORD",
        keywords: ["demo"],
      },
    },
    {
      id: "node_ask_time",
      type: "SEND_MESSAGE",
      position: { x: 350, y: 200 },
      data: {
        label: "Ask Slot",
        messageText: "Excellent! Please let us know your preferred date and time for the demo.",
      },
    },
    {
      id: "node_wait_time",
      type: "WAIT_FOR_REPLY",
      position: { x: 600, y: 200 },
      data: {
        label: "Wait Slot Input",
        timeoutMinutes: 30,
        saveReplyAs: "preferred_demo_time",
        acceptedReplyType: "TEXT",
      },
    },
    {
      id: "node_save_contact",
      type: "UPDATE_CONTACT_FIELD",
      position: { x: 850, y: 200 },
      data: {
        label: "Save Note",
      },
    },
    {
      id: "node_google_sheet",
      type: "GOOGLE_SHEET_APPEND_ROW",
      position: { x: 1100, y: 200 },
      data: {
        label: "Log to Sheet",
        connectedGoogleAccountId: "{{GOOGLE_CONNECTION_ID}}",
        spreadsheetId: "spreadsheet_placeholder",
        sheetName: "Sheet1",
        columnMappings: [
          {
            columnName: "Time",
            sourceType: "SESSION_CONTEXT",
            sourceValue: "preferred_demo_time",
          },
        ],
      },
    },
    {
      id: "node_ack_template",
      type: "SEND_TEMPLATE",
      position: { x: 1350, y: 200 },
      data: {
        label: "Send Confirmation Template",
        templateId: "{{WHATSAPP_TEMPLATE_DEMO_CONFIRM}}",
        templateName: "demo_confirm",
        languageCode: "en_US",
        headerVariableMappings: [],
        bodyVariableMappings: [],
        buttonVariableMappings: [],
      },
    },
    {
      id: "node_end",
      type: "END",
      position: { x: 1600, y: 200 },
      data: {
        label: "Done",
      },
    },
  ],
  edges: [
    { id: "e1", source: "node_start", target: "node_ask_time" },
    { id: "e2", source: "node_ask_time", target: "node_wait_time" },
    { id: "e3", source: "node_wait_time", target: "node_save_contact" },
    { id: "e4", source: "node_save_contact", target: "node_google_sheet" },
    { id: "e5", source: "node_google_sheet", target: "node_ack_template" },
    { id: "e6", source: "node_ack_template", target: "node_end" },
  ],
};

export const ORDER_STATUS_GRAPH: AutomationGraph = {
  version: 1,
  nodes: [
    {
      id: "node_start",
      type: "START",
      position: { x: 100, y: 200 },
      data: {
        label: "Trigger: Track Order",
        triggerType: "KEYWORD",
        keywords: ["order", "track"],
      },
    },
    {
      id: "node_ask_invoice",
      type: "SEND_MESSAGE",
      position: { x: 350, y: 200 },
      data: {
        label: "Ask Invoice No.",
        messageText: "Please reply with your Order or Invoice Number:",
      },
    },
    {
      id: "node_wait_invoice",
      type: "WAIT_FOR_REPLY",
      position: { x: 600, y: 200 },
      data: {
        label: "Wait Invoice No.",
        timeoutMinutes: 30,
        saveReplyAs: "order_number",
        acceptedReplyType: "TEXT",
      },
    },
    {
      id: "node_tally_lookup",
      type: "TALLY_LOOKUP",
      position: { x: 850, y: 200 },
      data: {
        label: "Lookup in Tally",
        lookupType: "INVOICE_STATUS",
        customerIdentifierSource: {
          sourceType: "SESSION_CONTEXT",
          sourceValue: "order_number",
        },
        saveResultAs: "tally_order_status",
      },
    },
    {
      id: "node_check_status",
      type: "CONDITION",
      position: { x: 1100, y: 200 },
      data: {
        label: "Found?",
        variable: "tally_order_status",
        operator: "IS_NOT_EMPTY",
      },
    },
    {
      id: "node_send_status",
      type: "SEND_MESSAGE",
      position: { x: 1350, y: 100 },
      data: {
        label: "Send Status",
        messageText: "Status: {{tally_order_status}}",
      },
    },
    {
      id: "node_handoff",
      type: "HUMAN_HANDOFF",
      position: { x: 1350, y: 300 },
      data: {
        label: "Escalate to Support",
      },
    },
    {
      id: "node_end",
      type: "END",
      position: { x: 1600, y: 200 },
      data: {
        label: "Done",
      },
    },
  ],
  edges: [
    { id: "e1", source: "node_start", target: "node_ask_invoice" },
    { id: "e2", source: "node_ask_invoice", target: "node_wait_invoice" },
    { id: "e3", source: "node_wait_invoice", target: "node_tally_lookup" },
    { id: "e4", source: "node_tally_lookup", target: "node_check_status" },
    { id: "e5", source: "node_check_status", target: "node_send_status", sourceHandle: "true", label: "Yes" },
    { id: "e6", source: "node_check_status", target: "node_handoff", sourceHandle: "false", label: "No" },
    { id: "e7", source: "node_send_status", target: "node_end" },
    { id: "e8", source: "node_handoff", target: "node_end" },
  ],
};

export const CUSTOMER_SUPPORT_GRAPH: AutomationGraph = {
  version: 1,
  nodes: [
    {
      id: "node_start",
      type: "START",
      position: { x: 100, y: 200 },
      data: {
        label: "Trigger: Help Keywords",
        triggerType: "KEYWORD",
        keywords: ["support", "help", "issue"],
      },
    },
    {
      id: "node_options",
      type: "QUICK_REPLY",
      position: { x: 350, y: 200 },
      data: {
        label: "Support Options",
        bodyText: "How can we help you today?",
        buttons: [
          { id: "billing", label: "Billing Issue" },
          { id: "product", label: "Product Help" },
          { id: "agent", label: "Talk to Agent" },
        ],
      },
    },
    {
      id: "node_wait",
      type: "WAIT_FOR_REPLY",
      position: { x: 600, y: 200 },
      data: {
        label: "Wait Choice",
        timeoutMinutes: 30,
        saveReplyAs: "support_choice",
        acceptedReplyType: "BUTTON",
      },
    },
    {
      id: "node_router",
      type: "BUTTON_REPLY_ROUTER",
      position: { x: 850, y: 200 },
      data: {
        label: "Route Support",
        sourceNodeId: "node_wait",
        routes: [
          { buttonId: "billing", buttonLabel: "Billing Issue" },
          { buttonId: "product", buttonLabel: "Product Help" },
          { buttonId: "agent", buttonLabel: "Talk to Agent" },
        ],
        fallbackEnabled: true,
      },
    },
    {
      id: "node_billing_info",
      type: "SEND_MESSAGE",
      position: { x: 1100, y: 100 },
      data: {
        label: "Billing Msg",
        messageText: "Redirecting you to our finance support agent...",
      },
    },
    {
      id: "node_ask_product",
      type: "SEND_MESSAGE",
      position: { x: 1100, y: 250 },
      data: {
        label: "Ask Detail",
        messageText: "Please reply with a description of the issue you are facing.",
      },
    },
    {
      id: "node_handoff",
      type: "HUMAN_HANDOFF",
      position: { x: 1350, y: 200 },
      data: {
        label: "Talk to Agent",
      },
    },
    {
      id: "node_end",
      type: "END",
      position: { x: 1600, y: 200 },
      data: {
        label: "Done",
      },
    },
  ],
  edges: [
    { id: "e1", source: "node_start", target: "node_options" },
    { id: "e2", source: "node_options", target: "node_wait" },
    { id: "e3", source: "node_wait", target: "node_router" },
    { id: "e4", source: "node_router", target: "node_billing_info", sourceHandle: "billing" },
    { id: "e5", source: "node_router", target: "node_ask_product", sourceHandle: "product" },
    { id: "e6", source: "node_router", target: "node_handoff", sourceHandle: "agent" },
    { id: "e7", source: "node_router", target: "node_handoff", sourceHandle: "fallback" },
    { id: "e8", source: "node_billing_info", target: "node_handoff" },
    { id: "e9", source: "node_ask_product", target: "node_handoff" },
    { id: "e10", source: "node_handoff", target: "node_end" },
  ],
};

export const FEEDBACK_COLLECTION_GRAPH: AutomationGraph = {
  version: 1,
  nodes: [
    {
      id: "node_start",
      type: "START",
      position: { x: 100, y: 200 },
      data: {
        label: "Trigger: Feedback",
        triggerType: "KEYWORD",
        keywords: ["feedback"],
      },
    },
    {
      id: "node_send_template",
      type: "SEND_TEMPLATE",
      position: { x: 350, y: 200 },
      data: {
        label: "Send Feedback Request",
        templateId: "{{WHATSAPP_TEMPLATE_FEEDBACK_REQUEST}}",
        templateName: "feedback_request",
        languageCode: "en_US",
        headerVariableMappings: [],
        bodyVariableMappings: [],
        buttonVariableMappings: [],
      },
    },
    {
      id: "node_wait_rating",
      type: "WAIT_FOR_REPLY",
      position: { x: 600, y: 200 },
      data: {
        label: "Wait Rating",
        timeoutMinutes: 60,
        saveReplyAs: "rating",
        acceptedReplyType: "ANY",
      },
    },
    {
      id: "node_condition",
      type: "CONDITION",
      position: { x: 850, y: 200 },
      data: {
        label: "Rating >= 4?",
        variable: "rating",
        operator: "GREATER_THAN",
        value: "3",
      },
    },
    {
      id: "node_thanks",
      type: "SEND_MESSAGE",
      position: { x: 1100, y: 100 },
      data: {
        label: "Thank You",
        messageText: "Thank you for the positive score! Please share a review on Google if you have a minute.",
      },
    },
    {
      id: "node_apology",
      type: "SEND_MESSAGE",
      position: { x: 1100, y: 300 },
      data: {
        label: "Acknowledge Negatives",
        messageText: "We apologize for the less-than-perfect experience. An agent will connect to assist you.",
      },
    },
    {
      id: "node_sheet_log",
      type: "GOOGLE_SHEET_APPEND_ROW",
      position: { x: 1350, y: 200 },
      data: {
        label: "Log Feedback",
        connectedGoogleAccountId: "{{GOOGLE_CONNECTION_ID}}",
        spreadsheetId: "spreadsheet_placeholder",
        sheetName: "Feedback",
        columnMappings: [
          {
            columnName: "Score",
            sourceType: "SESSION_CONTEXT",
            sourceValue: "rating",
          },
        ],
      },
    },
    {
      id: "node_end",
      type: "END",
      position: { x: 1600, y: 200 },
      data: {
        label: "Done",
      },
    },
  ],
  edges: [
    { id: "e1", source: "node_start", target: "node_send_template" },
    { id: "e2", source: "node_send_template", target: "node_wait_rating" },
    { id: "e3", source: "node_wait_rating", target: "node_condition" },
    { id: "e4", source: "node_condition", target: "node_thanks", sourceHandle: "true", label: "Yes" },
    { id: "e5", source: "node_condition", target: "node_apology", sourceHandle: "false", label: "No" },
    { id: "e6", source: "node_thanks", target: "node_sheet_log" },
    { id: "e7", source: "node_apology", target: "node_sheet_log" },
    { id: "e8", source: "node_sheet_log", target: "node_end" },
  ],
};

export const ABANDONED_PAYMENT_FOLLOW_UP_GRAPH: AutomationGraph = {
  version: 1,
  nodes: [
    {
      id: "node_start",
      type: "START",
      position: { x: 100, y: 200 },
      data: {
        label: "Trigger: Abandoned Link",
        triggerType: "KEYWORD",
        keywords: ["abandoned_trigger"],
      },
    },
    {
      id: "node_send_template",
      type: "SEND_TEMPLATE",
      position: { x: 350, y: 200 },
      data: {
        label: "Send Abandoned Follow-up",
        templateId: "{{WHATSAPP_TEMPLATE_ABANDONED_PAYMENT}}",
        templateName: "abandoned_payment",
        languageCode: "en_US",
        headerVariableMappings: [],
        bodyVariableMappings: [],
        buttonVariableMappings: [],
      },
    },
    {
      id: "node_wait",
      type: "WAIT_FOR_REPLY",
      position: { x: 600, y: 200 },
      data: {
        label: "Wait Response",
        timeoutMinutes: 120,
        saveReplyAs: "checkout_response",
        acceptedReplyType: "ANY",
      },
    },
    {
      id: "node_options",
      type: "QUICK_REPLY",
      position: { x: 850, y: 200 },
      data: {
        label: "Checkout Options",
        bodyText: "Need help completing your transaction?",
        buttons: [
          { id: "pay", label: "Pay Now" },
          { id: "help", label: "Request Help" },
        ],
      },
    },
    {
      id: "node_wait_btn",
      type: "WAIT_FOR_REPLY",
      position: { x: 1100, y: 200 },
      data: {
        label: "Wait Button Selection",
        timeoutMinutes: 30,
        saveReplyAs: "btn_selection",
        acceptedReplyType: "BUTTON",
      },
    },
    {
      id: "node_router",
      type: "BUTTON_REPLY_ROUTER",
      position: { x: 1350, y: 200 },
      data: {
        label: "Option Router",
        sourceNodeId: "node_wait_btn",
        routes: [
          { buttonId: "pay", buttonLabel: "Pay Now" },
          { buttonId: "help", buttonLabel: "Request Help" },
        ],
        fallbackEnabled: true,
      },
    },
    {
      id: "node_create_link",
      type: "PAYMENT_LINK",
      position: { x: 1600, y: 100 },
      data: {
        label: "Generate Link",
        provider: "CASHFREE",
        amountSource: {
          sourceType: "CUSTOM_ATTRIBUTE",
          sourceValue: "abandoned_amount",
        },
        currency: "INR",
        customerNameSource: {
          sourceType: "CONTACT_FIELD",
          sourceValue: "name",
        },
        customerPhoneSource: {
          sourceType: "CONTACT_FIELD",
          sourceValue: "phone",
        },
        purpose: "Recover Order",
        savePaymentLinkAs: "recovered_link",
        expiryMinutes: 120,
      },
    },
    {
      id: "node_send_link",
      type: "SEND_MESSAGE",
      position: { x: 1850, y: 100 },
      data: {
        label: "Send Link",
        messageText: "Here is your checkout link: {{recovered_link}}",
      },
    },
    {
      id: "node_handoff",
      type: "HUMAN_HANDOFF",
      position: { x: 1600, y: 300 },
      data: {
        label: "Escalate to Agent",
      },
    },
    {
      id: "node_end",
      type: "END",
      position: { x: 2100, y: 200 },
      data: {
        label: "Done",
      },
    },
  ],
  edges: [
    { id: "e1", source: "node_start", target: "node_send_template" },
    { id: "e2", source: "node_send_template", target: "node_wait" },
    { id: "e3", source: "node_wait", target: "node_options" },
    { id: "e4", source: "node_options", target: "node_wait_btn" },
    { id: "e5", source: "node_wait_btn", target: "node_router" },
    { id: "e6", source: "node_router", target: "node_create_link", sourceHandle: "pay" },
    { id: "e7", source: "node_router", target: "node_handoff", sourceHandle: "help" },
    { id: "e8", source: "node_router", target: "node_handoff", sourceHandle: "fallback" },
    { id: "e9", source: "node_create_link", target: "node_send_link" },
    { id: "e10", source: "node_send_link", target: "node_end" },
    { id: "e11", source: "node_handoff", target: "node_end" },
  ],
};

export const TALLY_LEDGER_BALANCE_GRAPH: AutomationGraph = {
  version: 1,
  nodes: [
    {
      id: "node_start",
      type: "START",
      position: { x: 100, y: 200 },
      data: {
        label: "Trigger: Ledger Balance",
        triggerType: "KEYWORD",
        keywords: ["balance", "ledger", "dues"],
      },
    },
    {
      id: "node_tally_lookup",
      type: "TALLY_LOOKUP",
      position: { x: 350, y: 200 },
      data: {
        label: "Query Ledger Balance",
        lookupType: "LEDGER_BALANCE",
        customerIdentifierSource: {
          sourceType: "CONTACT_FIELD",
          sourceValue: "phone",
        },
        saveResultAs: "ledger_balance",
      },
    },
    {
      id: "node_check_status",
      type: "CONDITION",
      position: { x: 600, y: 200 },
      data: {
        label: "Found Balance?",
        variable: "ledger_balance",
        operator: "IS_NOT_EMPTY",
      },
    },
    {
      id: "node_send_balance",
      type: "SEND_MESSAGE",
      position: { x: 850, y: 100 },
      data: {
        label: "Send Balance",
        messageText: "Your outstanding ledger balance is ₹{{ledger_balance}}.",
      },
    },
    {
      id: "node_handoff",
      type: "HUMAN_HANDOFF",
      position: { x: 850, y: 300 },
      data: {
        label: "Escalate to Billing Support",
      },
    },
    {
      id: "node_end",
      type: "END",
      position: { x: 1100, y: 200 },
      data: {
        label: "Done",
      },
    },
  ],
  edges: [
    { id: "e1", source: "node_start", target: "node_tally_lookup" },
    { id: "e2", source: "node_tally_lookup", target: "node_check_status" },
    { id: "e3", source: "node_check_status", target: "node_send_balance", sourceHandle: "true", label: "Yes" },
    { id: "e4", source: "node_check_status", target: "node_handoff", sourceHandle: "false", label: "No" },
    { id: "e5", source: "node_send_balance", target: "node_end" },
    { id: "e6", source: "node_handoff", target: "node_end" },
  ],
};

export const INVOICE_DUE_REMINDER_GRAPH: AutomationGraph = {
  version: 1,
  nodes: [
    {
      id: "node_start",
      type: "START",
      position: { x: 100, y: 200 },
      data: {
        label: "Trigger: Due Invoices",
        triggerType: "KEYWORD",
        keywords: ["due_invoices_trigger"],
      },
    },
    {
      id: "node_tally_lookup",
      type: "TALLY_LOOKUP",
      position: { x: 350, y: 200 },
      data: {
        label: "Check Customer Dues",
        lookupType: "CUSTOMER_DUES",
        customerIdentifierSource: {
          sourceType: "CONTACT_FIELD",
          sourceValue: "phone",
        },
        saveResultAs: "due_amount",
      },
    },
    {
      id: "node_check_dues",
      type: "CONDITION",
      position: { x: 600, y: 200 },
      data: {
        label: "Has Dues?",
        variable: "due_amount",
        operator: "GREATER_THAN",
        value: "0",
      },
    },
    {
      id: "node_send_template",
      type: "SEND_TEMPLATE",
      position: { x: 850, y: 100 },
      data: {
        label: "Send Dues Reminder",
        templateId: "{{WHATSAPP_TEMPLATE_DUE_REMINDER}}",
        templateName: "due_reminder",
        languageCode: "en_US",
        headerVariableMappings: [],
        bodyVariableMappings: [
          {
            variableName: "customer_name",
            component: "BODY",
            index: 1,
            sourceType: "CONTACT_FIELD",
            sourceValue: "name",
          },
          {
            variableName: "amount",
            component: "BODY",
            index: 2,
            sourceType: "SESSION_CONTEXT",
            sourceValue: "due_amount",
          },
        ],
        buttonVariableMappings: [],
      },
    },
    {
      id: "node_no_dues",
      type: "SEND_MESSAGE",
      position: { x: 850, y: 300 },
      data: {
        label: "Send Clear Status",
        messageText: "You have no outstanding invoice dues. Thank you!",
      },
    },
    {
      id: "node_end",
      type: "END",
      position: { x: 1100, y: 200 },
      data: {
        label: "Done",
      },
    },
  ],
  edges: [
    { id: "e1", source: "node_start", target: "node_tally_lookup" },
    { id: "e2", source: "node_tally_lookup", target: "node_check_dues" },
    { id: "e3", source: "node_check_dues", target: "node_send_template", sourceHandle: "true", label: "Yes" },
    { id: "e4", source: "node_check_dues", target: "node_no_dues", sourceHandle: "false", label: "No" },
    { id: "e5", source: "node_send_template", target: "node_end" },
    { id: "e6", source: "node_no_dues", target: "node_end" },
  ],
};
