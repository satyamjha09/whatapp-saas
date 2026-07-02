import type { Dispatch, SetStateAction } from "react";

export const automationNodeTypes = [
  "START",
  "SEND_MESSAGE",
  "QUICK_REPLY",
  "CONDITION",
  "SEND_TEMPLATE",
  "API_CALL",
  "HUMAN_HANDOFF",
  "END",
] as const;

export type AutomationNodeType = (typeof automationNodeTypes)[number];

export type AutomationTriggerType =
  | "KEYWORD"
  | "TEMPLATE_REPLY"
  | "BUTTON_REPLY"
  | "WEBHOOK"
  | "MANUAL";

export type AutomationButton = {
  id: string;
  label: string;
};

export type AutomationNodeData = Record<string, unknown> & {
  assignmentMode?: string;
  body?: string;
  bodyText?: string;
  buttons?: AutomationButton[];
  endReason?: string;
  headers?: string;
  inboxPriority?: string;
  keywords?: string[];
  label: string;
  languageCode?: string;
  mediaUrl?: string;
  messageText?: string;
  messageToCustomer?: string;
  method?: string;
  nodeType: AutomationNodeType;
  operator?: string;
  responseMapping?: string;
  templateId?: string;
  triggerType?: AutomationTriggerType;
  url?: string;
  value?: string;
  variable?: string;
  variableMappings?: string;
};

export type AutomationGraphNode = {
  data: AutomationNodeData;
  id: string;
  position: {
    x: number;
    y: number;
  };
  type: AutomationNodeType;
};

export type AutomationGraphEdge = {
  id: string;
  label?: string;
  source: string;
  target: string;
};

export type AutomationGraph = {
  edges: AutomationGraphEdge[];
  id: string;
  nodes: AutomationGraphNode[];
};

export type NodeFormProps = {
  draft: AutomationNodeData;
  errors: Record<string, string>;
  setDraft: Dispatch<SetStateAction<AutomationNodeData>>;
};

export function formatNodeType(type: AutomationNodeType) {
  return type
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getDefaultNodeData(type: AutomationNodeType): AutomationNodeData {
  if (type === "START") {
    return {
      keywords: ["hi", "hello"],
      label: "Start",
      nodeType: type,
      triggerType: "KEYWORD",
    };
  }

  if (type === "SEND_MESSAGE") {
    return {
      label: "Send Message",
      messageText: "Hi {{name}}, welcome to our business.",
      nodeType: type,
    };
  }

  if (type === "QUICK_REPLY") {
    return {
      bodyText: "Choose an option below.",
      buttons: [
        { id: "sales", label: "Sales" },
        { id: "support", label: "Support" },
      ],
      label: "Quick Replies",
      nodeType: type,
    };
  }

  if (type === "CONDITION") {
    return {
      label: "Condition",
      nodeType: type,
      operator: "equals",
      value: "sales",
      variable: "last_reply",
    };
  }

  if (type === "SEND_TEMPLATE") {
    return {
      label: "Send Template",
      languageCode: "en_US",
      nodeType: type,
      templateId: "",
      variableMappings: "{}",
    };
  }

  if (type === "API_CALL") {
    return {
      body: "{}",
      headers: "{}",
      label: "API Call",
      method: "POST",
      nodeType: type,
      responseMapping: "{}",
      url: "",
    };
  }

  if (type === "HUMAN_HANDOFF") {
    return {
      assignmentMode: "ROUND_ROBIN",
      inboxPriority: "NORMAL",
      label: "Human Handoff",
      messageToCustomer: "Our team will join this conversation shortly.",
      nodeType: type,
    };
  }

  return {
    endReason: "Completed",
    label: "End",
    nodeType: type,
  };
}

export function createDefaultAutomationGraph(flowId: string): AutomationGraph {
  return {
    edges: [
      {
        id: "edge_start_welcome",
        source: "node_start",
        target: "node_welcome",
      },
      {
        id: "edge_welcome_options",
        source: "node_welcome",
        target: "node_options",
      },
      {
        id: "edge_options_handoff",
        source: "node_options",
        target: "node_handoff",
      },
      {
        id: "edge_handoff_end",
        source: "node_handoff",
        target: "node_end",
      },
    ],
    id: flowId,
    nodes: [
      {
        data: getDefaultNodeData("START"),
        id: "node_start",
        position: { x: 80, y: 220 },
        type: "START",
      },
      {
        data: getDefaultNodeData("SEND_MESSAGE"),
        id: "node_welcome",
        position: { x: 390, y: 160 },
        type: "SEND_MESSAGE",
      },
      {
        data: getDefaultNodeData("QUICK_REPLY"),
        id: "node_options",
        position: { x: 710, y: 160 },
        type: "QUICK_REPLY",
      },
      {
        data: getDefaultNodeData("HUMAN_HANDOFF"),
        id: "node_handoff",
        position: { x: 1030, y: 160 },
        type: "HUMAN_HANDOFF",
      },
      {
        data: getDefaultNodeData("END"),
        id: "node_end",
        position: { x: 1350, y: 220 },
        type: "END",
      },
    ],
  };
}
