import type {
  AutomationNodeIconName,
  AutomationNodeType,
} from "@/lib/automation-builder/types";

const nodeLabels: Record<AutomationNodeType, string> = {
  ADD_TAG: "Add Tag",
  API_CALL: "API Call",
  CONDITION: "Condition",
  DELAY: "Delay",
  END: "End",
  BUTTON_REPLY_ROUTER: "Button Reply Router",
  HUMAN_HANDOFF: "Human Handoff",
  LIST_MESSAGE: "List Message",
  QUICK_REPLY: "Quick Reply",
  REMOVE_TAG: "Remove Tag",
  SEND_MESSAGE: "Send Message",
  SEND_TEMPLATE: "Send Template",
  START: "Start",
  TEMPLATE_TRIGGER: "Template Trigger",
  UPDATE_CONTACT_FIELD: "Update Contact Field",
  WAIT_FOR_REPLY: "Wait for Reply",
};

const nodeDescriptions: Record<AutomationNodeType, string> = {
  ADD_TAG: "Attach a tag to the contact",
  API_CALL: "Call an external endpoint",
  CONDITION: "Route by variable value",
  DELAY: "Wait before continuing",
  END: "Finish the journey",
  BUTTON_REPLY_ROUTER: "Route by clicked button",
  HUMAN_HANDOFF: "Move chat to team inbox",
  LIST_MESSAGE: "Send a WhatsApp list menu",
  QUICK_REPLY: "Send reply buttons",
  REMOVE_TAG: "Remove a tag from the contact",
  SEND_MESSAGE: "Send text or media",
  SEND_TEMPLATE: "Send approved template",
  START: "Choose trigger",
  TEMPLATE_TRIGGER: "Start from template replies",
  UPDATE_CONTACT_FIELD: "Save data on the contact",
  WAIT_FOR_REPLY: "Pause until customer replies",
};

const nodeIcons: Record<AutomationNodeType, AutomationNodeIconName> = {
  ADD_TAG: "tag",
  API_CALL: "api",
  CONDITION: "branch",
  DELAY: "delay",
  END: "end",
  BUTTON_REPLY_ROUTER: "router",
  HUMAN_HANDOFF: "handoff",
  LIST_MESSAGE: "list",
  QUICK_REPLY: "buttons",
  REMOVE_TAG: "tag",
  SEND_MESSAGE: "message",
  SEND_TEMPLATE: "template",
  START: "play",
  TEMPLATE_TRIGGER: "trigger",
  UPDATE_CONTACT_FIELD: "contact",
  WAIT_FOR_REPLY: "wait",
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
