import { Prisma } from "@/generated/prisma/client";
import type { TemplateVariableMapping } from "@/lib/automation-builder/types";
import type { AutomationTestSimulatedContact } from "@/server/validators/automation-test.validator";

export type AutomationTestTrigger = {
  type: "MANUAL_TEST";
  text?: string;
  buttonId?: string;
  listItemId?: string;
};

export type AutomationTestContext = {
  contact: AutomationTestSimulatedContact & {
    tags: string[];
  };
  dryRun: true;
  nodes: Record<string, { output?: unknown }>;
  replies: Record<string, unknown>;
  testMode: true;
  trigger: AutomationTestTrigger;
  variables: Record<string, unknown>;
};

export function safeTestJson(value: unknown): Prisma.InputJsonValue {
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

export function createInitialTestContext({
  initialMessage,
  simulatedContact,
}: {
  initialMessage: string;
  simulatedContact: AutomationTestSimulatedContact;
}): AutomationTestContext {
  return {
    contact: {
      ...simulatedContact,
      email: simulatedContact.email || undefined,
      tags: [],
    },
    dryRun: true,
    nodes: {},
    replies: {},
    testMode: true,
    trigger: {
      text: initialMessage,
      type: "MANUAL_TEST",
    },
    variables: {
      last_reply: initialMessage,
    },
  };
}

export function getTestContext(
  value: Prisma.JsonValue | null | undefined,
): AutomationTestContext | null {
  const context = asRecord(value);
  const trigger = asRecord(context.trigger);
  const contact = asRecord(context.contact);

  if (context.testMode !== true || context.dryRun !== true) return null;

  return {
    contact: {
      countryCode: stringValue(contact.countryCode, "91"),
      customAttributes: asRecord(contact.customAttributes),
      email: stringValue(contact.email) || undefined,
      name: stringValue(contact.name, "Test Contact"),
      phoneNumber: stringValue(contact.phoneNumber, "9876543210"),
      tags: Array.isArray(contact.tags)
        ? contact.tags.filter((tag): tag is string => typeof tag === "string")
        : [],
    },
    dryRun: true,
    nodes: asRecord(context.nodes) as AutomationTestContext["nodes"],
    replies: asRecord(context.replies),
    testMode: true,
    trigger: {
      buttonId: stringValue(trigger.buttonId) || undefined,
      listItemId: stringValue(trigger.listItemId) || undefined,
      text: stringValue(trigger.text),
      type: "MANUAL_TEST",
    },
    variables: asRecord(context.variables),
  };
}

export function getTestContextValue(
  context: AutomationTestContext,
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

export function setTestContextValue(
  context: AutomationTestContext,
  path: string,
  value: unknown,
) {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) return context;

  const nextContext = structuredClone(context);
  let cursor = nextContext as unknown as Record<string, unknown>;

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

export function addNodeOutput(
  context: AutomationTestContext,
  nodeId: string,
  output: unknown,
) {
  return setTestContextValue(context, `nodes.${nodeId}.output`, output);
}

function resolveValueBySource({
  context,
  mapping,
}: {
  context: AutomationTestContext;
  mapping: TemplateVariableMapping;
}) {
  if (mapping.sourceType === "STATIC") return mapping.sourceValue;

  if (mapping.sourceType === "CONTACT_FIELD") {
    return getTestContextValue(context, `contact.${mapping.sourceValue}`);
  }

  if (mapping.sourceType === "SESSION_CONTEXT") {
    return getTestContextValue(context, mapping.sourceValue);
  }

  if (mapping.sourceType === "PREVIOUS_NODE_OUTPUT") {
    return getTestContextValue(context, `nodes.${mapping.sourceValue}`);
  }

  if (mapping.sourceType === "CUSTOM_ATTRIBUTE") {
    return getTestContextValue(
      context,
      `contact.customAttributes.${mapping.sourceValue}`,
    );
  }

  return undefined;
}

export function resolveTestValue(
  mapping: TemplateVariableMapping,
  context: AutomationTestContext,
) {
  const value = resolveValueBySource({
    context,
    mapping,
  });

  if (value === undefined || value === null || value === "") {
    return mapping.fallbackValue ?? "";
  }

  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
