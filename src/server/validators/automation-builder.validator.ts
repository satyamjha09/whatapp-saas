import { z } from "zod";
import {
  normalizeAutomationGraph,
  validateAutomationGraph,
} from "@/lib/automation-builder/graph-validation";
import {
  automationNodeTypes,
  type AutomationNodeType,
} from "@/lib/automation-builder/types";

export const automationNodeTypeSchema = z.enum(automationNodeTypes);

const startNodeDataSchema = z.object({
  keywords: z.array(z.string().trim()).default([]),
  label: z.string().trim().min(1).max(120),
  triggerType: z.enum([
    "KEYWORD",
    "DEFAULT",
    "TEMPLATE_REPLY",
    "BUTTON_REPLY",
    "WEBHOOK",
    "MANUAL",
  ]),
});

const sendMessageNodeDataSchema = z.object({
  label: z.string().trim().min(1).max(120),
  mediaUrl: z.string().trim().url().optional(),
  messageText: z.string().max(4096),
});

const quickReplyNodeDataSchema = z.object({
  bodyText: z.string().trim().min(1).max(4096),
  buttons: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80),
        label: z.string().trim().min(1).max(20),
      }),
    )
    .min(1)
    .max(3),
  label: z.string().trim().min(1).max(120),
});

const listMessageNodeDataSchema = z.object({
  bodyText: z.string().trim().min(1).max(4096),
  buttonText: z.string().trim().min(1).max(20),
  label: z.string().trim().min(1).max(120),
  sections: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80),
        items: z
          .array(
            z.object({
              description: z.string().trim().max(72).optional(),
              id: z.string().trim().min(1).max(80),
              title: z.string().trim().min(1).max(24),
            }),
          )
          .min(1),
        title: z.string().trim().min(1).max(24),
      }),
    )
    .min(1),
});

const conditionNodeDataSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    operator: z.enum([
      "EQUALS",
      "NOT_EQUALS",
      "CONTAINS",
      "NOT_CONTAINS",
      "GREATER_THAN",
      "LESS_THAN",
      "IS_EMPTY",
      "IS_NOT_EMPTY",
    ]),
    value: z.union([z.string(), z.number(), z.boolean()]).optional(),
    variable: z.string().trim().min(1).max(120),
  })
  .superRefine((input, context) => {
    if (
      input.operator !== "IS_EMPTY" &&
      input.operator !== "IS_NOT_EMPTY" &&
      (input.value === undefined || input.value === "")
    ) {
      context.addIssue({
        code: "custom",
        message: "Condition value is required for this operator",
        path: ["value"],
      });
    }
  });

const templateTriggerNodeDataSchema = z
  .object({
    buttonIds: z.array(z.string().trim().min(1).max(120)).default([]),
    campaignId: z.string().trim().min(1).max(160).optional(),
    keywords: z.array(z.string().trim().min(1).max(120)).default([]),
    label: z.string().trim().min(1).max(120),
    templateId: z.string().trim().min(1).max(160).optional(),
    templateName: z.string().trim().max(160).optional(),
    triggerMode: z.enum([
      "ANY_TEMPLATE_REPLY",
      "SPECIFIC_TEMPLATE_REPLY",
      "SPECIFIC_CAMPAIGN_REPLY",
      "BUTTON_REPLY",
      "TEXT_REPLY",
    ]),
    triggerName: z.string().trim().min(1).max(160),
  })
  .superRefine((input, context) => {
    if (input.triggerMode === "SPECIFIC_TEMPLATE_REPLY" && !input.templateId) {
      context.addIssue({
        code: "custom",
        message: "Template is required for this trigger mode",
        path: ["templateId"],
      });
    }

    if (input.triggerMode === "SPECIFIC_CAMPAIGN_REPLY" && !input.campaignId) {
      context.addIssue({
        code: "custom",
        message: "Campaign ID is required for this trigger mode",
        path: ["campaignId"],
      });
    }

    if (input.triggerMode === "BUTTON_REPLY" && input.buttonIds.length === 0) {
      context.addIssue({
        code: "custom",
        message: "At least one button ID is required",
        path: ["buttonIds"],
      });
    }
  });

const templateVariableMappingSchema = z.object({
  component: z.enum(["HEADER", "BODY", "BUTTON"]),
  fallbackValue: z.string().trim().max(500).optional(),
  index: z.number().int().min(0).max(100),
  sourceType: z.enum([
    "CONTACT_FIELD",
    "STATIC",
    "SESSION_CONTEXT",
    "PREVIOUS_NODE_OUTPUT",
    "CUSTOM_ATTRIBUTE",
  ]),
  sourceValue: z.string().trim().max(500),
  variableName: z.string().trim().min(1).max(120),
});

const sendTemplateNodeDataSchema = z.object({
  bodyVariableMappings: z.array(templateVariableMappingSchema).default([]),
  buttonVariableMappings: z.array(templateVariableMappingSchema).default([]),
  category: z.string().trim().max(80).optional(),
  fallbackMessage: z.string().trim().max(1024).optional(),
  headerType: z
    .enum(["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"])
    .default("NONE"),
  headerVariableMappings: z.array(templateVariableMappingSchema).default([]),
  label: z.string().trim().min(1).max(120),
  languageCode: z.string().trim().min(1).max(20),
  mediaUrl: z.string().trim().url().optional(),
  templateId: z.string().trim().min(1).max(160),
  templateName: z.string().trim().max(160).optional(),
  templateStatus: z.string().trim().max(80).optional(),
});

const waitForReplyNodeDataSchema = z.object({
  acceptedReplyType: z.enum(["TEXT", "BUTTON", "LIST", "ANY"]),
  label: z.string().trim().min(1).max(120),
  saveReplyAs: z.string().trim().min(1).max(120),
  timeoutMessage: z.string().trim().max(1024).optional(),
  timeoutMinutes: z.number().int().min(1).max(10080),
});

const buttonReplyRouterNodeDataSchema = z
  .object({
    fallbackEnabled: z.boolean().default(true),
    label: z.string().trim().min(1).max(120),
    routes: z
      .array(
        z.object({
          buttonId: z.string().trim().min(1).max(120),
          buttonLabel: z.string().trim().min(1).max(120),
        }),
      )
      .min(1),
    sourceNodeId: z.string().trim().min(1).max(160),
  })
  .superRefine((input, context) => {
    const routeIds = input.routes.map((route) =>
      route.buttonId.trim().toLowerCase(),
    );

    if (new Set(routeIds).size !== routeIds.length) {
      context.addIssue({
        code: "custom",
        message: "Route button IDs must be unique",
        path: ["routes"],
      });
    }
  });

const apiCallNodeDataSchema = z.object({
  body: z.string().max(10000).optional(),
  headers: z.array(
    z.object({
      key: z.string().trim().min(1).max(120),
      value: z.string().trim().min(1).max(1000),
    }),
  ),
  label: z.string().trim().min(1).max(120),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  responseMapping: z.array(
    z.object({
      responsePath: z.string().trim().min(1).max(240),
      saveAs: z.string().trim().min(1).max(120),
    }),
  ),
  url: z.string().trim().url(),
});

const humanHandoffNodeDataSchema = z
  .object({
    assignedUserId: z.string().trim().min(1).max(120).optional(),
    assignmentMode: z.enum(["UNASSIGNED", "ROUND_ROBIN", "SPECIFIC_USER"]),
    inboxPriority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
    label: z.string().trim().min(1).max(120),
    messageToCustomer: z.string().trim().min(1).max(1024),
  })
  .superRefine((input, context) => {
    if (input.assignmentMode === "SPECIFIC_USER" && !input.assignedUserId) {
      context.addIssue({
        code: "custom",
        message: "Assigned user is required for specific-user handoff",
        path: ["assignedUserId"],
      });
    }
  });

const addTagNodeDataSchema = z.object({
  label: z.string().trim().min(1).max(120),
  tagName: z.string().trim().min(1).max(80),
});

const removeTagNodeDataSchema = z.object({
  label: z.string().trim().min(1).max(120),
  tagName: z.string().trim().min(1).max(80),
});

const updateContactFieldNodeDataSchema = z.object({
  fieldName: z.string().trim().min(1).max(120),
  fieldValue: z.string().trim().min(1).max(500),
  label: z.string().trim().min(1).max(120),
});

const delayNodeDataSchema = z.object({
  duration: z.number().positive(),
  label: z.string().trim().min(1).max(120),
  unit: z.enum(["SECONDS", "MINUTES", "HOURS", "DAYS"]),
});

const endNodeDataSchema = z.object({
  endReason: z.string().trim().max(240).optional(),
  label: z.string().trim().min(1).max(120),
});

const automationNodeDataSchemas = {
  ADD_TAG: addTagNodeDataSchema,
  API_CALL: apiCallNodeDataSchema,
  BUTTON_REPLY_ROUTER: buttonReplyRouterNodeDataSchema,
  CONDITION: conditionNodeDataSchema,
  DELAY: delayNodeDataSchema,
  END: endNodeDataSchema,
  HUMAN_HANDOFF: humanHandoffNodeDataSchema,
  LIST_MESSAGE: listMessageNodeDataSchema,
  QUICK_REPLY: quickReplyNodeDataSchema,
  REMOVE_TAG: removeTagNodeDataSchema,
  SEND_MESSAGE: sendMessageNodeDataSchema,
  SEND_TEMPLATE: sendTemplateNodeDataSchema,
  START: startNodeDataSchema,
  TEMPLATE_TRIGGER: templateTriggerNodeDataSchema,
  UPDATE_CONTACT_FIELD: updateContactFieldNodeDataSchema,
  WAIT_FOR_REPLY: waitForReplyNodeDataSchema,
} satisfies Record<AutomationNodeType, z.ZodType>;

export const automationEdgeSchema = z.object({
  id: z.string().trim().min(1).max(160),
  label: z.string().trim().max(120).optional(),
  source: z.string().trim().min(1).max(160),
  sourceHandle: z.string().trim().max(160).optional(),
  target: z.string().trim().min(1).max(160),
  targetHandle: z.string().trim().max(160).optional(),
});

export const automationNodeSchema = z
  .object({
    data: z.unknown(),
    id: z.string().trim().min(1).max(160),
    position: z.object({
      x: z.number().finite(),
      y: z.number().finite(),
    }),
    type: automationNodeTypeSchema,
  })
  .superRefine((input, context) => {
    const schema = automationNodeDataSchemas[input.type];
    const validation = schema.safeParse(input.data);

    if (!validation.success) {
      validation.error.issues.forEach((issue) => {
        context.addIssue({
          code: "custom",
          message: issue.message,
          path: ["data", ...issue.path],
        });
      });
    }
  });

export const automationGraphShapeSchema = z.object({
  edges: z.array(automationEdgeSchema),
  nodes: z.array(
    z.object({
      data: z.unknown().default({}),
      id: z.string().trim().min(1).max(160),
      position: z.object({
        x: z.number().finite(),
        y: z.number().finite(),
      }),
      type: automationNodeTypeSchema,
    }),
  ),
  version: z.literal(1).default(1),
});

export const automationGraphSchema = z.object({
  edges: z.array(automationEdgeSchema),
  nodes: z.array(automationNodeSchema),
  version: z.literal(1).default(1),
});

export const updateAutomationFlowSchema = z
  .object({
    action: z.enum(["SAVE_DRAFT", "PUBLISH"]).default("SAVE_DRAFT"),
    flowId: z.string().trim().min(1).max(160).optional(),
    graph: automationGraphSchema,
  })
  .superRefine((input, context) => {
    if (input.action !== "PUBLISH") return;

    const validation = validateAutomationGraph(
      normalizeAutomationGraph(input.graph),
    );

    validation.errors.forEach((error) => {
      context.addIssue({
        code: "custom",
        message: error.message,
        path: ["graph"],
      });
    });
  });

export type AutomationGraphInput = z.infer<typeof automationGraphSchema>;
export type AutomationGraphShapeInput = z.infer<typeof automationGraphShapeSchema>;
export type AutomationNodeInput = z.infer<typeof automationNodeSchema>;
export type AutomationEdgeInput = z.infer<typeof automationEdgeSchema>;
export type UpdateAutomationFlowInput = z.infer<
  typeof updateAutomationFlowSchema
>;
