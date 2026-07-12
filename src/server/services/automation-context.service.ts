import { Prisma } from "@/generated/prisma/client";
import type {
  AutomationGraph,
  TemplateVariableMapping,
} from "@/lib/automation-builder/types";

export type AutomationRuntimeContact = {
  id: string;
  name: string | null;
  email: string | null;
  companyName: string | null;
  phoneNumber: string;
  countryCode: string;
  source?: string | null;
  lifecycleStage?: string | null;
};

export type AutomationRuntimeMessage = {
  id: string;
  body: string;
  metadata: Prisma.JsonValue | null;
  campaignId?: string | null;
  templateId?: string | null;
};

export type AutomationTriggerSnapshot = {
  inboundMessageId: string;
  text: string;
  buttonId: string | null;
  buttonText: string | null;
  listItemId: string | null;
  listItemText: string | null;
  messageType: string;
  campaignId?: string | null;
  templateId?: string | null;
};

export type AutomationContext = {
  catalog?: {
    interaction?: {
      type: string | null;
    };
    messageId?: string | null;
    product?: {
      localProductId: string | null;
      name: string | null;
      retailerId: string | null;
    };
  };
  trigger: AutomationTriggerSnapshot;
  contact: {
    id: string;
    name: string | null;
    email: string | null;
    companyName: string | null;
    phoneNumber: string;
    countryCode: string;
  };
  replies: Record<string, unknown>;
  nodes: Record<string, { output?: unknown }>;
  variables: Record<string, unknown>;
};

export function safeJson(value: unknown): Prisma.InputJsonValue {
  return (value ?? Prisma.JsonNull) as Prisma.InputJsonValue;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function normalizedText(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function readCatalogContext(metadata: Prisma.JsonValue | null | undefined) {
  const catalogInteraction = asRecord(asRecord(metadata).catalogInteraction);
  if (!catalogInteraction.interactionType) return undefined;

  const products = Array.isArray(catalogInteraction.products)
    ? catalogInteraction.products
    : [];
  const firstProduct = asRecord(products[0]);
  const localProductIds = Array.isArray(catalogInteraction.localProductIds)
    ? catalogInteraction.localProductIds
    : [];
  const retailerIds = Array.isArray(catalogInteraction.retailerIds)
    ? catalogInteraction.retailerIds
    : [];

  return {
    interaction: {
      type: stringValue(catalogInteraction.interactionType) || null,
    },
    messageId:
      stringValue(catalogInteraction.outboundMessageId) ||
      stringValue(catalogInteraction.contextMetaMessageId) ||
      null,
    product: {
      localProductId:
        stringValue(firstProduct.localProductId) ||
        stringValue(localProductIds[0]) ||
        null,
      name: stringValue(firstProduct.name) || null,
      retailerId:
        stringValue(firstProduct.retailerId) ||
        stringValue(retailerIds[0]) ||
        null,
    },
  };
}

export function getAutomationContext(
  value: Prisma.JsonValue | null | undefined,
): AutomationContext | null {
  const context = asRecord(value);
  const trigger = asRecord(context.trigger);
  const contact = asRecord(context.contact);

  if (!trigger.inboundMessageId || !contact.id) {
    return null;
  }

  return {
    trigger: {
      inboundMessageId: stringValue(trigger.inboundMessageId),
      text: stringValue(trigger.text),
      buttonId: stringValue(trigger.buttonId) || null,
      buttonText: stringValue(trigger.buttonText) || null,
      listItemId: stringValue(trigger.listItemId) || null,
      listItemText: stringValue(trigger.listItemText) || null,
      messageType: stringValue(trigger.messageType, "TEXT"),
      campaignId: stringValue(trigger.campaignId) || null,
      templateId: stringValue(trigger.templateId) || null,
    },
    contact: {
      id: stringValue(contact.id),
      name: stringValue(contact.name) || null,
      email: stringValue(contact.email) || null,
      companyName: stringValue(contact.companyName) || null,
      phoneNumber: stringValue(contact.phoneNumber),
      countryCode: stringValue(contact.countryCode, "91"),
    },
    catalog: asRecord(context.catalog) as AutomationContext["catalog"],
    replies: asRecord(context.replies),
    nodes: asRecord(context.nodes) as AutomationContext["nodes"],
    variables: asRecord(context.variables),
  };
}

export function extractInboundTrigger(
  message: AutomationRuntimeMessage,
): AutomationTriggerSnapshot {
  const metadata = asRecord(message.metadata);
  const messageType = stringValue(metadata.messageType, "TEXT");

  if (messageType === "BUTTON") {
    const payload = stringValue(metadata.payload);
    const text = stringValue(metadata.text, message.body).trim();

    return {
      inboundMessageId: message.id,
      text,
      buttonId: payload || text || null,
      buttonText: text || null,
      listItemId: null,
      listItemText: null,
      messageType,
      campaignId: message.campaignId ?? null,
      templateId: message.templateId ?? null,
    };
  }

  if (messageType === "INTERACTIVE") {
    const interactive = asRecord(metadata.interactive);
    const buttonReply = asRecord(interactive.button_reply);
    const listReply = asRecord(interactive.list_reply);
    const buttonId = stringValue(buttonReply.id);
    const buttonText = stringValue(buttonReply.title);
    const listItemId = stringValue(listReply.id);
    const listItemText = stringValue(listReply.title);

    return {
      inboundMessageId: message.id,
      text: buttonText || listItemText || message.body.trim(),
      buttonId: buttonId || null,
      buttonText: buttonText || null,
      listItemId: listItemId || null,
      listItemText: listItemText || null,
      messageType,
      campaignId: message.campaignId ?? null,
      templateId: message.templateId ?? null,
    };
  }

  return {
    inboundMessageId: message.id,
    text: message.body.trim(),
    buttonId: null,
    buttonText: null,
    listItemId: null,
    listItemText: null,
    messageType,
    campaignId: message.campaignId ?? null,
    templateId: message.templateId ?? null,
  };
}

export function createAutomationContext({
  contact,
  message,
}: {
  contact: AutomationRuntimeContact;
  message: AutomationRuntimeMessage;
}): AutomationContext {
  const catalog = readCatalogContext(message.metadata);

  return {
    trigger: extractInboundTrigger(message),
    ...(catalog ? { catalog } : {}),
    contact: {
      countryCode: contact.countryCode,
      email: contact.email,
      companyName: contact.companyName,
      id: contact.id,
      name: contact.name,
      phoneNumber: contact.phoneNumber,
    },
    replies: {},
    nodes: {},
    variables: {},
  };
}

export function getAutomationContextValue(
  context: AutomationContext,
  path: string,
) {
  if (!path.trim()) return undefined;

  const parts = path.split(".").filter(Boolean);
  let value: unknown = context;

  for (const part of parts) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }

    value = (value as Record<string, unknown>)[part];
  }

  return value;
}

export function setAutomationContextValue(
  context: AutomationContext,
  path: string,
  value: unknown,
) {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) return context;

  const nextContext = structuredClone(context);
  let cursor: Record<string, unknown> = nextContext as unknown as Record<
    string,
    unknown
  >;

  parts.slice(0, -1).forEach((part) => {
    const existing = cursor[part];
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, unknown>;
  });

  cursor[parts[parts.length - 1]!] = value;
  return nextContext;
}

export function setNodeOutput(
  context: AutomationContext,
  nodeId: string,
  output: unknown,
) {
  return setAutomationContextValue(context, `nodes.${nodeId}.output`, output);
}

export function resolveAutomationValue({
  contact,
  context,
  mapping,
}: {
  contact: AutomationRuntimeContact;
  context: AutomationContext;
  mapping: TemplateVariableMapping;
}) {
  let value: unknown;

  if (mapping.sourceType === "STATIC") {
    value = mapping.sourceValue;
  }

  if (mapping.sourceType === "CONTACT_FIELD") {
    value =
      contact[mapping.sourceValue as keyof AutomationRuntimeContact] ??
      getAutomationContextValue(context, `contact.${mapping.sourceValue}`);
  }

  if (mapping.sourceType === "SESSION_CONTEXT") {
    value = getAutomationContextValue(context, mapping.sourceValue);
  }

  if (mapping.sourceType === "PREVIOUS_NODE_OUTPUT") {
    value = getAutomationContextValue(context, `nodes.${mapping.sourceValue}`);
  }

  if (mapping.sourceType === "CUSTOM_ATTRIBUTE") {
    value = getAutomationContextValue(
      context,
      `variables.customAttributes.${mapping.sourceValue}`,
    );
  }

  if (value === undefined || value === null || value === "") {
    value = mapping.fallbackValue ?? "";
  }

  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export function resolveTemplateMappings({
  contact,
  context,
  mappings,
}: {
  contact: AutomationRuntimeContact;
  context: AutomationContext;
  mappings: TemplateVariableMapping[];
}) {
  return mappings.map((mapping) => ({
    ...mapping,
    value: resolveAutomationValue({
      contact,
      context,
      mapping,
    }),
  }));
}

export function graphFromJson(value: Prisma.JsonValue): AutomationGraph | null {
  const graph = asRecord(value);

  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    return null;
  }

  return {
    version: graph.version === 1 ? 1 : 1,
    nodes: graph.nodes as AutomationGraph["nodes"],
    edges: graph.edges as AutomationGraph["edges"],
  };
}
