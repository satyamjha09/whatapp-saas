import { prisma } from "@/lib/prisma";
import type { BillingPlan } from "@/generated/prisma/client";
import { automationNodeTypes } from "@/lib/automation-builder/types";
import type { AutomationNodeType } from "@/lib/automation-builder/types";

export type PlanTier = "STARTER" | "PRO" | "BUSINESS" | "ENTERPRISE";

export type PlanFeatureLimits = {
  maxFlows: number | null;
  maxPublishedFlows: number | null;
  monthlyExecutions: number | null;
  monthlyTestRuns: number | null;
  maxVersionsPerFlow: number | null;
  templateLibrary: boolean;
  basicAnalytics: boolean;
  advancedAnalytics: boolean;
  approvalWorkflow: boolean;
  allowedNodes: string[];
};

export class PlanFeatureAccessError extends Error {
  public code: string;
  public requiredPlan?: string;

  constructor(message: string, code = "PLAN_FEATURE_LOCKED", requiredPlan?: string) {
    super(message);
    this.name = "PlanFeatureAccessError";
    this.code = code;
    this.requiredPlan = requiredPlan;
  }
}

const STARTER_NODES: AutomationNodeType[] = [
  "START",
  "TEMPLATE_TRIGGER",
  "SEND_MESSAGE",
  "SEND_TEMPLATE",
  "QUICK_REPLY",
  "WAIT_FOR_REPLY",
  "BUTTON_REPLY_ROUTER",
  "CONDITION",
  "DELAY",
  "ADD_TAG",
  "UPDATE_CONTACT_FIELD",
  "HUMAN_HANDOFF",
  "END",
];

const PRO_NODES: AutomationNodeType[] = [
  ...STARTER_NODES,
  "LIST_MESSAGE",
  "API_CALL",
  "WEBHOOK",
  "GOOGLE_SHEET_APPEND_ROW",
  "GOOGLE_SHEET_UPDATE_ROW",
  "PAYMENT_LINK",
  "REMOVE_TAG",
  "FALLBACK",
  "ERROR_HANDLER",
];

const BUSINESS_NODES: AutomationNodeType[] = [
  ...PRO_NODES,
  "TALLY_LOOKUP",
  "CATALOG_SEND",
  "AI_REPLY",
  "RETRY",
];

const FEATURE_KEY_TO_LIMIT_KEY: Record<string, keyof PlanFeatureLimits> = {
  "automation.flows.max": "maxFlows",
  "automation.published_flows.max": "maxPublishedFlows",
  "automation.executions.monthly": "monthlyExecutions",
  "automation.test_runs.monthly": "monthlyTestRuns",
  "automation.versions.max_per_flow": "maxVersionsPerFlow",
  "automation.approvals.enabled": "approvalWorkflow",
  "automation.approval_workflow.enabled": "approvalWorkflow",
  "automation.analytics.basic": "basicAnalytics",
  "automation.analytics.advanced": "advancedAnalytics",
  "automation.templates_library.enabled": "templateLibrary",
};

const NODE_FEATURE_KEY_TO_NODE_TYPE: Record<string, AutomationNodeType> = {
  "automation.node.send_message": "SEND_MESSAGE",
  "automation.node.quick_reply": "QUICK_REPLY",
  "automation.node.list_message": "LIST_MESSAGE",
  "automation.node.send_template": "SEND_TEMPLATE",
  "automation.node.condition": "CONDITION",
  "automation.node.wait_for_reply": "WAIT_FOR_REPLY",
  "automation.node.human_handoff": "HUMAN_HANDOFF",
  "automation.node.webhook": "WEBHOOK",
  "automation.node.google_sheet": "GOOGLE_SHEET_APPEND_ROW",
  "automation.node.tally": "TALLY_LOOKUP",
  "automation.node.payment_link": "PAYMENT_LINK",
  "automation.node.catalog": "CATALOG_SEND",
  "automation.node.ai_reply": "AI_REPLY",
  "automation.node.api_call": "API_CALL",
};

export const PLAN_CONFIGS: Record<PlanTier, PlanFeatureLimits> = {
  STARTER: {
    maxFlows: 3,
    maxPublishedFlows: 1,
    monthlyExecutions: 500,
    monthlyTestRuns: 100,
    maxVersionsPerFlow: 5,
    templateLibrary: true,
    basicAnalytics: true,
    advancedAnalytics: false,
    approvalWorkflow: false,
    allowedNodes: STARTER_NODES,
  },
  PRO: {
    maxFlows: 25,
    maxPublishedFlows: 10,
    monthlyExecutions: 20000,
    monthlyTestRuns: 2000,
    maxVersionsPerFlow: 25,
    templateLibrary: true,
    basicAnalytics: true,
    advancedAnalytics: true,
    approvalWorkflow: false,
    allowedNodes: PRO_NODES,
  },
  BUSINESS: {
    maxFlows: 100,
    maxPublishedFlows: 50,
    monthlyExecutions: 100000,
    monthlyTestRuns: 10000,
    maxVersionsPerFlow: 100,
    templateLibrary: true,
    basicAnalytics: true,
    advancedAnalytics: true,
    approvalWorkflow: true,
    allowedNodes: BUSINESS_NODES,
  },
  ENTERPRISE: {
    maxFlows: null,
    maxPublishedFlows: null,
    monthlyExecutions: null,
    monthlyTestRuns: null,
    maxVersionsPerFlow: null,
    templateLibrary: true,
    basicAnalytics: true,
    advancedAnalytics: true,
    approvalWorkflow: true,
    allowedNodes: [
      ...automationNodeTypes,
    ],
  },
};

export function mapBillingPlanToTier(billingPlan?: BillingPlan | string): PlanTier {
  if (!billingPlan) return "STARTER";
  const planStr = billingPlan.toString().toUpperCase();

  switch (planStr) {
    case "ENTERPRISE":
      return "ENTERPRISE";
    case "BUSINESS":
      return "BUSINESS";
    case "GROWTH":
    case "PRO":
      return "PRO";
    case "STARTER":
    case "FREE":
    default:
      return "STARTER";
  }
}

export function getRequiredPlanForNode(nodeType: string): PlanTier {
  const typedNodeType = nodeType as AutomationNodeType;
  if (STARTER_NODES.includes(typedNodeType)) return "STARTER";
  if (PRO_NODES.includes(typedNodeType)) return "PRO";
  if (BUSINESS_NODES.includes(typedNodeType)) return "BUSINESS";
  return "ENTERPRISE";
}

export async function getCompanyPlan(companyId: string): Promise<PlanTier> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { billingPlan: true },
  });

  return mapBillingPlanToTier(company?.billingPlan);
}

export async function getCompanyPlanFeatures(companyId: string): Promise<PlanFeatureLimits> {
  const tier = await getCompanyPlan(companyId);
  const baseConfig = { ...PLAN_CONFIGS[tier] };

  // Check custom company overrides if present
  const overrides = await prisma.companyFeatureOverride.findMany({
    where: { companyId },
  });

  if (overrides.length > 0) {
    overrides.forEach((ov) => {
      const directKey =
        ov.featureKey in baseConfig
          ? (ov.featureKey as keyof PlanFeatureLimits)
          : FEATURE_KEY_TO_LIMIT_KEY[ov.featureKey];

      if (directKey) {
        (baseConfig as Record<string, unknown>)[directKey] = ov.value;
      }
    });
  }

  return baseConfig;
}

export async function getFeatureLimit(
  companyId: string,
  featureKey: string,
): Promise<unknown> {
  const features = await getCompanyPlanFeatures(companyId);
  const limitKey =
    featureKey in features
      ? (featureKey as keyof PlanFeatureLimits)
      : FEATURE_KEY_TO_LIMIT_KEY[featureKey];

  if (limitKey) return features[limitKey];

  if (featureKey === "automation.runtime.enabled") return true;
  if (featureKey === "automation.runtime.priority") {
    const plan = await getCompanyPlan(companyId);
    return plan === "BUSINESS" || plan === "ENTERPRISE";
  }

  const nodeType = NODE_FEATURE_KEY_TO_NODE_TYPE[featureKey];
  if (nodeType) return features.allowedNodes.includes(nodeType);

  return null;
}

export async function hasFeature(
  companyId: string,
  featureKey: string,
): Promise<boolean> {
  const value = await getFeatureLimit(companyId, featureKey);
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  return value !== null && value !== undefined;
}

export async function getAllowedAutomationNodes(companyId: string): Promise<string[]> {
  const features = await getCompanyPlanFeatures(companyId);
  return features.allowedNodes;
}

export async function isAutomationNodeAllowed(
  companyId: string,
  nodeType: string
): Promise<boolean> {
  const allowedNodes = await getAllowedAutomationNodes(companyId);
  return allowedNodes.includes(nodeType);
}

export async function requireAutomationNodeAccess(
  companyId: string,
  nodeType: string
): Promise<void> {
  const allowed = await isAutomationNodeAllowed(companyId, nodeType);
  if (!allowed) {
    const requiredPlan = getRequiredPlanForNode(nodeType);
    throw new PlanFeatureAccessError(
      `Node type "${nodeType}" requires the ${requiredPlan} plan or higher. Upgrade to unlock this node.`,
      "PLAN_NODE_LOCKED",
      requiredPlan
    );
  }
}

export async function requireFeature(
  companyId: string,
  featureKey: string
): Promise<void> {
  const val = await getFeatureLimit(companyId, featureKey);

  if (!val) {
    throw new PlanFeatureAccessError(
      `Feature "${featureKey}" is not included in your current subscription plan. Upgrade to unlock.`,
      "PLAN_FEATURE_LOCKED"
    );
  }
}
