import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { randomUUID } from "crypto";
import { isCashfreeCheckoutConfigured } from "@/server/services/cashfree-payment.service";
import {
  getAutomationFlowTemplate,
  listAutomationFlowTemplates as listRegisteredAutomationFlowTemplates,
  AUTOMATION_FLOW_TEMPLATES,
} from "../../lib/automation-templates/template-registry";
import { validateAutomationFlowTemplate } from "../../lib/automation-templates/template-validation";
import type {
  AutomationFlowTemplate,
  AutomationFlowTemplateRequirementType,
  AutomationTemplateSetupChecklistItem,
} from "../../lib/automation-templates/template-types";
import type {
  AutomationGraph,
  AutomationNode,
  GoogleSheetAppendRowNodeData,
  GoogleSheetUpdateRowNodeData,
  SendTemplateNodeData,
  StartNodeData,
} from "../../lib/automation-builder/types";

export class TemplateNotFoundError extends Error {
  constructor(slug: string) {
    super(`Template with slug "${slug}" was not found.`);
    this.name = "TemplateNotFoundError";
  }
}

export class TemplateMappingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateMappingValidationError";
  }
}

function generateNodeId(prefix: string): string {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

function parseKeywordInput(value?: string | null): string[] {
  if (!value) return [];

  const seen = new Set<string>();
  const keywords: string[] = [];

  value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((keyword) => {
      const key = keyword.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        keywords.push(keyword);
      }
    });

  return keywords;
}

function templatePlaceholder(key: string) {
  return `{{WHATSAPP_TEMPLATE_${key.toUpperCase()}}}`;
}

function integrationPlaceholder(type: AutomationFlowTemplateRequirementType) {
  if (type === "GOOGLE_CONNECTION") return "{{GOOGLE_CONNECTION_ID}}";
  if (type === "TALLY_CONNECTION") return "{{TALLY_CONNECTION_ID}}";
  if (type === "CASHFREE") return "{{CASHFREE_PROVIDER}}";
  return "";
}

function integrationAliases(type: AutomationFlowTemplateRequirementType) {
  if (type === "GOOGLE_CONNECTION") return ["GOOGLE_CONNECTION", "GOOGLE"];
  if (type === "TALLY_CONNECTION") return ["TALLY_CONNECTION", "TALLY"];
  return [type];
}

function getMappedIntegrationValue(
  type: AutomationFlowTemplateRequirementType,
  mappings?: Record<string, string>,
) {
  if (!mappings) return "";

  for (const alias of integrationAliases(type)) {
    const value = mappings[alias]?.trim();
    if (value) return value;
  }

  return "";
}

function checklistIntegrationKey(itemKey: string) {
  return itemKey.replace("CONNECT_", "");
}

function checklistTemplateKey(itemKey: string) {
  return itemKey.replace("SELECT_WHATSAPP_TEMPLATE_", "");
}

type ValidatedTemplateMapping = {
  category: string;
  id: string;
  language: string;
  name: string;
  status: string;
};

type MissingTemplateRequirement = {
  key: string;
  label: string;
  message: string;
  required: boolean;
  type: string;
};

function warnAboutTemplateRegistryIssues() {
  if (process.env.NODE_ENV === "production") return;

  const issues = AUTOMATION_FLOW_TEMPLATES.flatMap((template) =>
    validateAutomationFlowTemplate(template, AUTOMATION_FLOW_TEMPLATES).map((issue) => ({
      ...issue,
      templateSlug: template.slug,
    })),
  );

  if (issues.length > 0) {
    console.warn("AUTOMATION_TEMPLATE_REGISTRY_ISSUES:", issues);
  }
}

let registryWarned = false;

function warnAboutTemplateRegistryIssuesOnce() {
  if (registryWarned) return;
  registryWarned = true;
  warnAboutTemplateRegistryIssues();
}

export function getAutomationFlowTemplateBySlug(slug: string) {
  warnAboutTemplateRegistryIssuesOnce();
  return getAutomationFlowTemplate(slug);
}

export function listAutomationFlowTemplateSummaries(filters?: {
  category?: string;
  difficulty?: string;
  integration?: string;
  search?: string;
  tag?: string;
}) {
  warnAboutTemplateRegistryIssuesOnce();
  return listRegisteredAutomationFlowTemplates(filters).map((template) => ({
    category: template.category,
    description: template.description,
    difficulty: template.difficulty,
    estimatedSetupMinutes: template.estimatedSetupMinutes,
    name: template.name,
    nodesCount: template.graph.nodes.length,
    previewNodeTypes: Array.from(new Set(template.graph.nodes.map((node) => node.type))),
    requiredIntegrations: template.requiredIntegrations,
    slug: template.slug,
    tags: template.tags,
  }));
}

export function cloneAutomationTemplateGraph(
  graph: AutomationGraph,
  triggerKeyword?: string
): AutomationGraph {
  const cloned = JSON.parse(JSON.stringify(graph)) as AutomationGraph;
  const nodeIdMap = new Map<string, string>();
  const overrideKeywords = parseKeywordInput(triggerKeyword);

  // 1. Generate new Node IDs and apply trigger keyword override if available
  cloned.nodes.forEach((node) => {
    const newId = generateNodeId(node.type.toLowerCase());
    nodeIdMap.set(node.id, newId);
    node.id = newId;

    if (node.type === "START" && overrideKeywords.length > 0) {
      if (!node.data) {
        node.data = { label: "Trigger: Keyword", triggerType: "KEYWORD", keywords: [] } as StartNodeData;
      }
      const data = node.data as StartNodeData;
      data.keywords = overrideKeywords;
      data.triggerType = "KEYWORD";
    }
  });

  // 2. Map old edge source/target IDs to new Node IDs and generate new Edge IDs
  cloned.edges.forEach((edge) => {
    edge.id = generateNodeId("edge");
    const newSource = nodeIdMap.get(edge.source);
    const newTarget = nodeIdMap.get(edge.target);

    if (newSource) edge.source = newSource;
    if (newTarget) edge.target = newTarget;
  });

  return cloned;
}

export async function validateTemplateUseRequest(
  companyId: string,
  template: AutomationFlowTemplate,
  input: {
    templateMappings?: Record<string, string>;
    integrationMappings?: Record<string, string>;
  }
) {
  const missingRequirements: MissingTemplateRequirement[] = [];
  const validTemplateMappings = new Map<string, ValidatedTemplateMapping>();
  const validIntegrationMappings = new Set<AutomationFlowTemplateRequirementType>();

  for (const requirement of template.requiredWhatsAppTemplates) {
    const templateId = input.templateMappings?.[requirement.key]?.trim();

    if (!templateId) {
      missingRequirements.push({
        key: requirement.key,
        label: requirement.label,
        message: `Select an approved WhatsApp template for "${requirement.label}".`,
        required: true,
        type: "WHATSAPP_TEMPLATE",
      });
      continue;
    }

    const dbTemplate = await prisma.template.findFirst({
      where: {
        companyId,
        id: templateId,
      },
      select: {
        category: true,
        id: true,
        language: true,
        name: true,
        status: true,
      },
    });

    if (!dbTemplate) {
      throw new TemplateMappingValidationError(
        `Template ID "${templateId}" does not belong to this workspace.`,
      );
    }

    if (dbTemplate.status !== "APPROVED") {
      throw new TemplateMappingValidationError(
        `Template "${dbTemplate.name}" is ${dbTemplate.status}. Only APPROVED templates can be mapped.`,
      );
    }

    validTemplateMappings.set(requirement.key, {
      category: dbTemplate.category,
      id: dbTemplate.id,
      language: dbTemplate.language,
      name: dbTemplate.name,
      status: dbTemplate.status,
    });
  }

  for (const requirement of template.requiredIntegrations) {
    const mappedValue = getMappedIntegrationValue(requirement.type, input.integrationMappings);

    if (requirement.type === "CASHFREE") {
      if (isCashfreeCheckoutConfigured()) {
        validIntegrationMappings.add("CASHFREE");
      } else if (requirement.required || mappedValue) {
        missingRequirements.push({
          key: requirement.type,
          label: requirement.label,
          message: "Cashfree checkout credentials are not configured yet.",
          required: requirement.required,
          type: requirement.type,
        });
      }
      continue;
    }

    if (mappedValue) {
      throw new TemplateMappingValidationError(
        `${requirement.label} mapping cannot be verified yet. Connect this integration from the builder after the tenant-safe connection model exists.`,
      );
    }

    if (requirement.required) {
      missingRequirements.push({
        key: requirement.type,
        label: requirement.label,
        message: `Connect ${requirement.label} before publishing this flow.`,
        required: true,
        type: requirement.type,
      });
    }
  }

  return {
    missingRequirements,
    validIntegrationMappings,
    validTemplateMappings,
  };
}

function applyTemplateMappingsToGraph(
  graph: AutomationGraph,
  mappings: Map<string, ValidatedTemplateMapping>,
) {
  if (mappings.size === 0) return graph;

  const cloned = JSON.parse(JSON.stringify(graph)) as AutomationGraph;

  cloned.nodes.forEach((node: AutomationNode) => {
    if (node.type !== "SEND_TEMPLATE") return;

    const data = node.data as SendTemplateNodeData;
    const mapping = Array.from(mappings.entries()).find(([key]) => {
      return data.templateId === templatePlaceholder(key) || data.templateName === key;
    });

    if (!mapping) return;

    const [, template] = mapping;
    data.category = template.category;
    data.languageCode = template.language;
    data.templateId = template.id;
    data.templateName = template.name;
    data.templateStatus = template.status;
  });

  return cloned;
}

function applyVerifiedIntegrationMappingsToGraph(
  graph: AutomationGraph,
  mappings: Set<AutomationFlowTemplateRequirementType>,
) {
  if (mappings.size === 0) return graph;

  const graphText = Array.from(mappings).reduce((text, type) => {
    const placeholder = integrationPlaceholder(type);
    if (!placeholder) return text;
    return text.replaceAll(placeholder, type);
  }, JSON.stringify(graph));

  const resolvedGraph = JSON.parse(graphText) as AutomationGraph;

  resolvedGraph.nodes.forEach((node) => {
    if (node.type === "GOOGLE_SHEET_APPEND_ROW") {
      const data = node.data as GoogleSheetAppendRowNodeData;
      if (data.connectedGoogleAccountId === "GOOGLE_CONNECTION") {
        data.connectedGoogleAccountId = "";
      }
    }

    if (node.type === "GOOGLE_SHEET_UPDATE_ROW") {
      const data = node.data as GoogleSheetUpdateRowNodeData;
      if (data.connectedGoogleAccountId === "GOOGLE_CONNECTION") {
        data.connectedGoogleAccountId = "";
      }
    }
  });

  return resolvedGraph;
}

function isChecklistItemComplete(
  item: AutomationTemplateSetupChecklistItem,
  validTemplateMappings: Map<string, ValidatedTemplateMapping>,
  validIntegrationMappings: Set<AutomationFlowTemplateRequirementType>,
) {
  if (item.completedBy === "TEMPLATE_MAPPING") {
    return validTemplateMappings.has(checklistTemplateKey(item.key));
  }

  if (item.completedBy === "INTEGRATION_MAPPING") {
    const key = checklistIntegrationKey(item.key);
    return Array.from(validIntegrationMappings).some((type) =>
      integrationAliases(type).includes(key),
    );
  }

  return false;
}

export async function createAutomationFlowFromTemplate(
  companyId: string,
  templateSlug: string,
  input: {
    name?: string;
    description?: string;
    triggerKeyword?: string;
    templateMappings?: Record<string, string>;
    integrationMappings?: Record<string, string>;
  },
  actorUserId?: string | null
) {
  const template = getAutomationFlowTemplate(templateSlug);
  if (!template) {
    throw new TemplateNotFoundError(templateSlug);
  }

  const { checkCanCreateAutomationFlow, checkCanUseTemplateLibrary } = await import("./automation-plan-limit.service");
  await checkCanCreateAutomationFlow(companyId);
  const templateNodeTypes = Array.from(new Set(template.graph.nodes.map((n) => n.type)));
  await checkCanUseTemplateLibrary(companyId, templateNodeTypes);

  // 1. Validate the mapping requests
  const { missingRequirements, validIntegrationMappings, validTemplateMappings } =
    await validateTemplateUseRequest(companyId, template, input);

  // 2. Clone the static template graph
  const clonedGraph = cloneAutomationTemplateGraph(template.graph, input.triggerKeyword);

  // 3. Apply mappings (template IDs, integration IDs) to the cloned graph
  const graphWithTemplates = applyTemplateMappingsToGraph(clonedGraph, validTemplateMappings);
  const resolvedGraph = applyVerifiedIntegrationMappingsToGraph(
    graphWithTemplates,
    validIntegrationMappings,
  );

  // 4. Compute the dynamic setup checklist
  const updatedChecklist: AutomationTemplateSetupChecklistItem[] = template.setupChecklist.map((item) => {
    return {
      key: item.key,
      title: item.title,
      description: item.description,
      required: item.required,
      completedBy: item.completedBy,
      completed: isChecklistItemComplete(
        item,
        validTemplateMappings,
        validIntegrationMappings,
      ),
    } as AutomationTemplateSetupChecklistItem;
  });

  // 5. Store metadata JSON
  const flowMetadata = {
    sourceTemplateSlug: template.slug,
    sourceTemplateName: template.name,
    setupChecklist: updatedChecklist,
    createdFromTemplateAt: new Date().toISOString(),
  };

  const startNode = template.graph.nodes.find((n) => n.type === "START");
  const overrideKeywords = parseKeywordInput(input.triggerKeyword);
  const keywords = overrideKeywords.length > 0
    ? overrideKeywords
    : (startNode?.data as StartNodeData)?.keywords ?? [];

  // 6. Persist AutomationFlow draft in DB
  const flow = await prisma.automationFlow.create({
    data: {
      companyId,
      name: (input.name?.trim() || template.name).slice(0, 100),
      description: input.description?.trim() || template.description,
      status: "DRAFT",
      draftGraph: resolvedGraph as unknown as Prisma.InputJsonValue,
      triggerType: "KEYWORD",
      keywords,
      isDefault: false,
      createdByUserId: actorUserId,
      metadata: flowMetadata as Prisma.InputJsonValue,
    },
  });

  return {
    flowId: flow.id,
    redirectUrl: `/dashboard/automation/builder/${flow.id}`,
    setupChecklist: updatedChecklist,
    missingRequirements,
  };
}
