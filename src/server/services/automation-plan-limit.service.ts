import { prisma } from "@/lib/prisma";
import type { AutomationGraph } from "@/lib/automation-builder/types";
import { graphFromJson } from "@/server/services/automation-context.service";
import {
  getCompanyPlanFeatures,
  getRequiredPlanForNode,
  PlanFeatureAccessError,
} from "./plan-feature.service";
import { getOrCreateUsageCounter } from "./automation-usage.service";

export async function checkCanCreateAutomationFlow(companyId: string): Promise<void> {
  const limits = await getCompanyPlanFeatures(companyId);

  if (limits.maxFlows === null) return;

  const currentFlowCount = await prisma.automationFlow.count({
    where: { companyId, status: { not: "ARCHIVED" } },
  });

  if (currentFlowCount >= limits.maxFlows) {
    throw new PlanFeatureAccessError(
      `Your current plan allows a maximum of ${limits.maxFlows} automation flows. Upgrade your plan to create more.`,
      "PLAN_FLOW_LIMIT_REACHED"
    );
  }
}

export async function checkCanPublishAutomationFlow(
  companyId: string,
  flowId: string,
  graph: AutomationGraph
): Promise<{ allowed: boolean; lockedNodes: string[] }> {
  const limits = await getCompanyPlanFeatures(companyId);

  // 1. Check published flow count limit
  if (limits.maxPublishedFlows !== null) {
    const currentPublishedCount = await prisma.automationFlow.count({
      where: {
        companyId,
        status: "PUBLISHED",
        id: { not: flowId },
      },
    });

    if (currentPublishedCount >= limits.maxPublishedFlows) {
      throw new PlanFeatureAccessError(
        `Your current plan allows a maximum of ${limits.maxPublishedFlows} published flows. Upgrade to publish more automations.`,
        "PLAN_PUBLISHED_FLOW_LIMIT_REACHED"
      );
    }
  }

  if (limits.maxVersionsPerFlow !== null) {
    const currentVersionCount = await prisma.automationFlowVersion.count({
      where: { companyId, flowId },
    });

    if (currentVersionCount >= limits.maxVersionsPerFlow) {
      throw new PlanFeatureAccessError(
        `Your current plan allows a maximum of ${limits.maxVersionsPerFlow} versions per flow. Upgrade to publish more versions.`,
        "PLAN_VERSION_LIMIT_REACHED"
      );
    }
  }

  if (!limits.approvalWorkflow) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { automationPublishApprovalRequired: true },
    });

    if (company?.automationPublishApprovalRequired) {
      throw new PlanFeatureAccessError(
        "Automation approval workflow is not included in your current plan. Disable approval workflow or upgrade to Business.",
        "PLAN_FEATURE_LOCKED",
        "BUSINESS"
      );
    }
  }

  // 2. Validate all nodes in graph against allowed nodes
  const graphNodeTypes = Array.from(new Set(graph.nodes.map((n) => n.type)));
  const lockedNodes = graphNodeTypes.filter(
    (nodeType) => !limits.allowedNodes.includes(nodeType)
  );

  if (lockedNodes.length > 0) {
    const lockedDetails = lockedNodes
      .map((nodeType) => `${nodeType} (requires ${getRequiredPlanForNode(nodeType)})`)
      .join(", ");

    throw new PlanFeatureAccessError(
      `This flow contains nodes not supported by your plan: ${lockedDetails}. Upgrade your plan to publish this automation.`,
      "PLAN_NODE_LOCKED"
    );
  }

  return { allowed: true, lockedNodes: [] };
}

export async function checkCanSaveDraft(
  companyId: string,
  _flowId: string,
  graph: AutomationGraph
): Promise<{ allowed: boolean; warnings: string[]; lockedNodes: string[] }> {
  const limits = await getCompanyPlanFeatures(companyId);
  const graphNodeTypes = Array.from(new Set(graph.nodes.map((n) => n.type)));
  const lockedNodes = graphNodeTypes.filter(
    (nodeType) => !limits.allowedNodes.includes(nodeType)
  );

  const warnings: string[] = [];
  if (lockedNodes.length > 0) {
    warnings.push(
      `Flow draft contains ${lockedNodes.length} locked node(s): ${lockedNodes.join(", ")}. Upgrade plan to publish.`
    );
  }

  return { allowed: true, warnings, lockedNodes };
}

export async function checkCanRunLiveTest(companyId: string): Promise<void> {
  const limits = await getCompanyPlanFeatures(companyId);

  if (limits.monthlyTestRuns === null) return;

  const counter = await getOrCreateUsageCounter(companyId);
  if (counter.testRunsUsed >= limits.monthlyTestRuns) {
    throw new PlanFeatureAccessError(
      `Monthly live test limit reached (${counter.testRunsUsed}/${limits.monthlyTestRuns}). Upgrade your plan for more test runs.`,
      "PLAN_TEST_LIMIT_REACHED"
    );
  }
}

export async function checkCanUseTemplateLibrary(
  companyId: string,
  templateNodes: string[]
): Promise<{ allowed: boolean; lockedNodes: string[] }> {
  const limits = await getCompanyPlanFeatures(companyId);

  if (!limits.templateLibrary) {
    throw new PlanFeatureAccessError(
      "Template Library is not enabled on your current plan.",
      "PLAN_FEATURE_LOCKED"
    );
  }

  const lockedNodes = templateNodes.filter(
    (nodeType) => !limits.allowedNodes.includes(nodeType)
  );

  if (lockedNodes.length > 0) {
    const lockedDetails = lockedNodes
      .map((nodeType) => `${nodeType} (requires ${getRequiredPlanForNode(nodeType)})`)
      .join(", ");

    throw new PlanFeatureAccessError(
      `This automation template contains nodes not supported by your plan: ${lockedDetails}. Upgrade your plan to use this template.`,
      "PLAN_NODE_LOCKED",
      lockedNodes
        .map((nodeType) => getRequiredPlanForNode(nodeType))
        .sort((a, b) => ["STARTER", "PRO", "BUSINESS", "ENTERPRISE"].indexOf(b) - ["STARTER", "PRO", "BUSINESS", "ENTERPRISE"].indexOf(a))[0]
    );
  }

  return { allowed: true, lockedNodes: [] };
}

export async function checkCanRunAutomationExecution(
  companyId: string,
  flowId: string
): Promise<void> {
  const limits = await getCompanyPlanFeatures(companyId);

  const counter = await getOrCreateUsageCounter(companyId);
  if (limits.monthlyExecutions !== null && counter.executionsUsed >= limits.monthlyExecutions) {
    throw new PlanFeatureAccessError(
      `Monthly automation execution limit reached (${counter.executionsUsed}/${limits.monthlyExecutions}). Executions paused until upgrade or next billing cycle.`,
      "PLAN_EXECUTION_LIMIT_REACHED"
    );
  }

  if (!flowId) return;

  const flow = await prisma.automationFlow.findFirst({
    where: { companyId, id: flowId },
    select: { publishedVersionId: true },
  });

  if (!flow?.publishedVersionId) return;

  const version = await prisma.automationFlowVersion.findFirst({
    where: { companyId, flowId, id: flow.publishedVersionId },
    select: { graph: true },
  });

  const publishedGraph = version ? graphFromJson(version.graph) : null;

  if (!publishedGraph) return;

  const graphNodeTypes = Array.from(new Set(publishedGraph.nodes.map((node) => node.type)));
  const lockedNodes = graphNodeTypes.filter(
    (nodeType) => !limits.allowedNodes.includes(nodeType)
  );

  if (lockedNodes.length > 0) {
    const lockedDetails = lockedNodes
      .map((nodeType) => `${nodeType} (requires ${getRequiredPlanForNode(nodeType)})`)
      .join(", ");

    throw new PlanFeatureAccessError(
      `This published flow contains nodes not supported by the current plan: ${lockedDetails}. Upgrade your plan or republish without locked nodes.`,
      "PLAN_NODE_LOCKED"
    );
  }
}
