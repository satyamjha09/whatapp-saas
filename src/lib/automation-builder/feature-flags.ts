import type { AutomationNodeType } from "@/lib/automation-builder/types";

export const advancedAutomationNodeTypes = [
  "WEBHOOK",
  "GOOGLE_SHEET_APPEND_ROW",
  "GOOGLE_SHEET_UPDATE_ROW",
  "TALLY_LOOKUP",
  "PAYMENT_LINK",
  "CATALOG_SEND",
  "AI_REPLY",
  "FALLBACK",
  "RETRY",
  "ERROR_HANDLER",
] as const satisfies readonly AutomationNodeType[];

const flagByNodeType: Partial<Record<AutomationNodeType, string>> = {
  AI_REPLY: "AUTOMATION_AI_REPLY_NODE_ENABLED",
  CATALOG_SEND: "AUTOMATION_CATALOG_NODE_ENABLED",
  ERROR_HANDLER: "AUTOMATION_ERROR_HANDLER_NODE_ENABLED",
  FALLBACK: "AUTOMATION_FALLBACK_NODE_ENABLED",
  GOOGLE_SHEET_APPEND_ROW: "AUTOMATION_GOOGLE_SHEET_NODE_ENABLED",
  GOOGLE_SHEET_UPDATE_ROW: "AUTOMATION_GOOGLE_SHEET_NODE_ENABLED",
  PAYMENT_LINK: "AUTOMATION_PAYMENT_LINK_NODE_ENABLED",
  RETRY: "AUTOMATION_RETRY_NODE_ENABLED",
  TALLY_LOOKUP: "AUTOMATION_TALLY_NODE_ENABLED",
  WEBHOOK: "AUTOMATION_WEBHOOK_NODE_ENABLED",
};

const defaultEnabled: Partial<Record<AutomationNodeType, boolean>> = {
  ERROR_HANDLER: true,
  FALLBACK: true,
  RETRY: true,
  WEBHOOK: true,
};

const publicEnvFlags: Record<string, string | undefined> = {
  AUTOMATION_AI_REPLY_NODE_ENABLED:
    process.env.NEXT_PUBLIC_AUTOMATION_AI_REPLY_NODE_ENABLED,
  AUTOMATION_CATALOG_NODE_ENABLED:
    process.env.NEXT_PUBLIC_AUTOMATION_CATALOG_NODE_ENABLED,
  AUTOMATION_ERROR_HANDLER_NODE_ENABLED:
    process.env.NEXT_PUBLIC_AUTOMATION_ERROR_HANDLER_NODE_ENABLED,
  AUTOMATION_FALLBACK_NODE_ENABLED:
    process.env.NEXT_PUBLIC_AUTOMATION_FALLBACK_NODE_ENABLED,
  AUTOMATION_GOOGLE_SHEET_NODE_ENABLED:
    process.env.NEXT_PUBLIC_AUTOMATION_GOOGLE_SHEET_NODE_ENABLED,
  AUTOMATION_PAYMENT_LINK_NODE_ENABLED:
    process.env.NEXT_PUBLIC_AUTOMATION_PAYMENT_LINK_NODE_ENABLED,
  AUTOMATION_RETRY_NODE_ENABLED:
    process.env.NEXT_PUBLIC_AUTOMATION_RETRY_NODE_ENABLED,
  AUTOMATION_TALLY_NODE_ENABLED:
    process.env.NEXT_PUBLIC_AUTOMATION_TALLY_NODE_ENABLED,
  AUTOMATION_WEBHOOK_NODE_ENABLED:
    process.env.NEXT_PUBLIC_AUTOMATION_WEBHOOK_NODE_ENABLED,
};

function envFlag(name: string | undefined) {
  if (!name) return true;

  const publicValue = publicEnvFlags[name] ?? process.env[name] ?? undefined;

  if (publicValue === undefined) return undefined;

  return ["1", "true", "yes", "on", "enabled"].includes(
    publicValue.trim().toLowerCase(),
  );
}

export function getAutomationNodeFeatureFlag(type: AutomationNodeType) {
  return flagByNodeType[type] ?? null;
}

export function isAdvancedAutomationNode(type: AutomationNodeType) {
  return advancedAutomationNodeTypes.includes(
    type as (typeof advancedAutomationNodeTypes)[number],
  );
}

export function isAutomationNodeTypeEnabled(type: AutomationNodeType) {
  const flag = getAutomationNodeFeatureFlag(type);
  const value = envFlag(flag ?? undefined);

  if (value !== undefined) return value;

  return defaultEnabled[type] ?? !isAdvancedAutomationNode(type);
}
