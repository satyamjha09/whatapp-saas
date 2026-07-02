import type {
  AutomationNodeIconName,
  AutomationNodeType,
} from "@/lib/automation-builder/types";

const nodeLabels: Record<AutomationNodeType, string> = {
  ADD_TAG: "Add Tag",
  AI_REPLY: "AI Reply",
  API_CALL: "API Call",
  CONDITION: "Condition",
  CATALOG_SEND: "Catalog Send",
  DELAY: "Delay",
  END: "End",
  ERROR_HANDLER: "Error Handler",
  FALLBACK: "Fallback",
  BUTTON_REPLY_ROUTER: "Button Reply Router",
  GOOGLE_SHEET_APPEND_ROW: "Google Sheet Append Row",
  GOOGLE_SHEET_UPDATE_ROW: "Google Sheet Update Row",
  HUMAN_HANDOFF: "Human Handoff",
  LIST_MESSAGE: "List Message",
  PAYMENT_LINK: "Payment Link",
  QUICK_REPLY: "Quick Reply",
  REMOVE_TAG: "Remove Tag",
  RETRY: "Retry",
  SEND_MESSAGE: "Send Message",
  SEND_TEMPLATE: "Send Template",
  START: "Start",
  TALLY_LOOKUP: "Tally Lookup",
  TEMPLATE_TRIGGER: "Template Trigger",
  UPDATE_CONTACT_FIELD: "Update Contact Field",
  WAIT_FOR_REPLY: "Wait for Reply",
  WEBHOOK: "Webhook",
};

const nodeDescriptions: Record<AutomationNodeType, string> = {
  ADD_TAG: "Attach a tag to the contact",
  AI_REPLY: "Draft a response with AI",
  API_CALL: "Call an external endpoint",
  CONDITION: "Route by variable value",
  CATALOG_SEND: "Show products or a fallback list",
  DELAY: "Wait before continuing",
  END: "Finish the journey",
  ERROR_HANDLER: "Handle failed paths safely",
  FALLBACK: "Standard fallback action",
  BUTTON_REPLY_ROUTER: "Route by clicked button",
  GOOGLE_SHEET_APPEND_ROW: "Append data to a sheet",
  GOOGLE_SHEET_UPDATE_ROW: "Update a matched sheet row",
  HUMAN_HANDOFF: "Move chat to team inbox",
  LIST_MESSAGE: "Send a WhatsApp list menu",
  PAYMENT_LINK: "Create a payment link",
  QUICK_REPLY: "Send reply buttons",
  REMOVE_TAG: "Remove a tag from the contact",
  RETRY: "Retry a failed path with limits",
  SEND_MESSAGE: "Send text or media",
  SEND_TEMPLATE: "Send approved template",
  START: "Choose trigger",
  TALLY_LOOKUP: "Lookup ledger, invoice, or stock data",
  TEMPLATE_TRIGGER: "Start from template replies",
  UPDATE_CONTACT_FIELD: "Save data on the contact",
  WAIT_FOR_REPLY: "Pause until customer replies",
  WEBHOOK: "Call a secured webhook",
};

const nodeIcons: Record<AutomationNodeType, AutomationNodeIconName> = {
  ADD_TAG: "tag",
  AI_REPLY: "ai",
  API_CALL: "api",
  CONDITION: "branch",
  CATALOG_SEND: "catalog",
  DELAY: "delay",
  END: "end",
  ERROR_HANDLER: "error",
  FALLBACK: "fallback",
  BUTTON_REPLY_ROUTER: "router",
  GOOGLE_SHEET_APPEND_ROW: "sheet",
  GOOGLE_SHEET_UPDATE_ROW: "sheet",
  HUMAN_HANDOFF: "handoff",
  LIST_MESSAGE: "list",
  PAYMENT_LINK: "payment",
  QUICK_REPLY: "buttons",
  REMOVE_TAG: "tag",
  RETRY: "retry",
  SEND_MESSAGE: "message",
  SEND_TEMPLATE: "template",
  START: "play",
  TALLY_LOOKUP: "tally",
  TEMPLATE_TRIGGER: "trigger",
  UPDATE_CONTACT_FIELD: "contact",
  WAIT_FOR_REPLY: "wait",
  WEBHOOK: "webhook",
};

export function getAutomationNodeLabel(type: AutomationNodeType) {
  return nodeLabels[type];
}

export function getAutomationNodeDescription(type: AutomationNodeType) {
  return nodeDescriptions[type];
}

export function getAutomationNodeIcon(type: AutomationNodeType) {
  return nodeIcons[type];
}
