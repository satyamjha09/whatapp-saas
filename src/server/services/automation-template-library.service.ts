import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { randomUUID } from "crypto";
import {
  getAutomationFlowTemplate,
} from "../../lib/automation-templates/template-registry";
import type {
  AutomationFlowTemplate,
  AutomationTemplateSetupChecklistItem,
} from "../../lib/automation-templates/template-types";
import type { AutomationGraph, StartNodeData, SendTemplateNodeData } from "../../lib/automation-builder/types";

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

export function cloneAutomationTemplateGraph(
  graph: AutomationGraph,
  triggerKeyword?: string
): AutomationGraph {
  const cloned = JSON.parse(JSON.stringify(graph)) as AutomationGraph;
  const nodeIdMap = new Map<string, string>();

  // 1. Generate new Node IDs and apply trigger keyword override if available
  cloned.nodes.forEach((node) => {
    const newId = generateNodeId(node.type.toLowerCase());
    nodeIdMap.set(node.id, newId);
    node.id = newId;

    if (node.type === "START" && triggerKeyword) {
      if (!node.data) {
        node.data = { label: "Trigger: Keyword", triggerType: "KEYWORD", keywords: [] } as StartNodeData;
      }
      const data = node.data as StartNodeData;
      data.keywords = [triggerKeyword.trim()];
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
  const missingRequirements: Array<{
    type: string;
    key: string;
    label: string;
    message: string;
  }> = [];

  // Validate WhatsApp Template mappings if provided
  if (input.templateMappings) {
    for (const [reqKey, templateId] of Object.entries(input.templateMappings)) {
      const reqConfig = template.requiredWhatsAppTemplates.find((w) => w.key === reqKey);
      if (!reqConfig) continue;

      if (templateId) {
        // Query database to verify template ownership and status
        const dbTemplate = await prisma.template.findFirst({
          where: {
            id: templateId,
            companyId,
          },
        });

        if (!dbTemplate) {
          missingRequirements.push({
            type: "WHATSAPP_TEMPLATE",
            key: reqKey,
            label: reqConfig.label,
            message: `Template ID "${templateId}" is not configured for this company.`,
          });
        } else if (dbTemplate.status !== "APPROVED") {
          missingRequirements.push({
            type: "WHATSAPP_TEMPLATE",
            key: reqKey,
            label: reqConfig.label,
            message: `Template "${dbTemplate.name}" has status ${dbTemplate.status}. It must be APPROVED to use in automation.`,
          });
        }
      }
    }
  }

  // Validate Integrations if provided
  if (input.integrationMappings) {
    for (const [reqType, connectionId] of Object.entries(input.integrationMappings)) {
      const reqConfig = template.requiredIntegrations.find((r) => r.type === reqType);
      if (!reqConfig) continue;

      // In this Phase, integration connections are simulated. We just verify the presence of the mapped ID.
      if (reqConfig.required && !connectionId) {
        missingRequirements.push({
          type: reqType,
          key: reqType,
          label: reqConfig.label,
          message: `Integration "${reqConfig.label}" is required.`,
        });
      }
    }
  }

  return { missingRequirements };
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

  // 1. Validate the mapping requests
  const { missingRequirements } = await validateTemplateUseRequest(companyId, template, input);

  // 2. Clone the static template graph
  const clonedGraph = cloneAutomationTemplateGraph(template.graph, input.triggerKeyword);

  // 3. Apply mappings (template IDs, integration IDs) to the cloned graph
  const graphText = JSON.stringify(clonedGraph);
  let resolvedGraphText = graphText;

  // Apply template mappings
  if (input.templateMappings) {
    for (const [reqKey, templateId] of Object.entries(input.templateMappings)) {
      if (!templateId) continue;
      const placeholder = `{{WHATSAPP_TEMPLATE_${reqKey.toUpperCase()}}}`;

      // Fetch template details to pre-populate name and language in the graph nodes
      const dbTemplate = await prisma.template.findFirst({
        where: { id: templateId, companyId },
      });

      if (dbTemplate) {
        // Replace in raw JSON text to handle nested string values
        resolvedGraphText = resolvedGraphText.replace(new RegExp(placeholder, "g"), templateId);
      }
    }
  }

  // Apply integration mappings
  if (input.integrationMappings) {
    for (const [reqType, connectionId] of Object.entries(input.integrationMappings)) {
      if (!connectionId) continue;
      let placeholder = "";
      if (reqType === "GOOGLE_CONNECTION") {
        placeholder = "{{GOOGLE_CONNECTION_ID}}";
      } else if (reqType === "TALLY_CONNECTION") {
        placeholder = "{{TALLY_CONNECTION_ID}}";
      } else if (reqType === "CASHFREE") {
        placeholder = "{{CASHFREE_PROVIDER}}";
      }

      if (placeholder) {
        resolvedGraphText = resolvedGraphText.replace(new RegExp(placeholder, "g"), connectionId);
      }
    }
  }

  const resolvedGraph = JSON.parse(resolvedGraphText) as AutomationGraph;

  // If there are still mapped nodes that need specific property updates, handle them:
  resolvedGraph.nodes.forEach((node) => {
    if (node.type === "SEND_TEMPLATE" && node.data) {
      const data = node.data as SendTemplateNodeData;
      // If templateId has been replaced by a real cuid/uuid instead of keeping the placeholder:
      if (data.templateId && !data.templateId.startsWith("{{")) {
        // Make sure node labels look clean
        data.templateStatus = "APPROVED";
      }
    }
  });

  // 4. Compute the dynamic setup checklist
  const updatedChecklist: AutomationTemplateSetupChecklistItem[] = template.setupChecklist.map((item) => {
    let completed = false;

    if (item.completedBy === "TEMPLATE_MAPPING" && input.templateMappings) {
      // Find the specific template key
      const keySuffix = item.key.replace("SELECT_WHATSAPP_TEMPLATE_", "");
      const mappedId = input.templateMappings[keySuffix];
      const hasValidMapping = mappedId && !missingRequirements.some((mr) => mr.key === keySuffix);
      if (hasValidMapping) {
        completed = true;
      }
    } else if (item.completedBy === "INTEGRATION_MAPPING" && input.integrationMappings) {
      const keySuffix = item.key.replace("CONNECT_", "");
      const mappedId = input.integrationMappings[keySuffix];
      const hasValidMapping = mappedId && !missingRequirements.some((mr) => mr.key === keySuffix);
      if (hasValidMapping) {
        completed = true;
      }
    }

    return {
      key: item.key,
      title: item.title,
      description: item.description,
      required: item.required,
      completedBy: item.completedBy,
      completed, // Dynamic indicator
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
  const keywords = input.triggerKeyword
    ? [input.triggerKeyword.trim()]
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
