import { prisma } from "@/lib/prisma";
import {
  assertNoUnresolvedVariables,
  renderPreview,
  resolveAutomationVariables,
} from "@/lib/whatsapp-template/template-variable-engine";
import type {
  AutomationNode,
  AutomationNodeType,
  TemplateVariableMapping,
} from "@/lib/automation-builder/types";
import { assertContactCanReceiveTemplate } from "@/server/services/contact-consent.service";
import { recordContactActivity } from "@/server/services/contact-activity.service";
import { createQueuedAutomationOutboundMessage } from "@/server/services/automation-outbound-message.service";
import { createQueuedTemplateMessage } from "@/server/services/message.service";
import { executeAdvancedAutomationNode } from "@/server/services/automation-advanced-node-executor.service";
import { readFlowTemplateRuntimeConfig } from "@/server/services/whatsapp-flow.service";
import {
  asRecord,
  getAutomationContextValue,
  normalizedText,
  resolveTemplateMappings,
  setAutomationContextValue,
  stringValue,
  type AutomationContext,
  type AutomationRuntimeContact,
  type AutomationRuntimeMessage,
} from "@/server/services/automation-context.service";
import {
  completeAutomationSession,
  markAutomationSessionWaiting,
  pauseAutomationSessionForHandoff,
  setAutomationSessionLastOutboundMessage,
} from "@/server/services/automation-session.service";

export type AutomationNodeExecutionInput = {
  companyId: string;
  contact: AutomationRuntimeContact;
  context: AutomationContext;
  executionId: string;
  executionStepId?: string;
  inboundMessage: AutomationRuntimeMessage;
  node: AutomationNode;
  sessionId: string;
};

export type AutomationNodeExecutionResult = {
  context: AutomationContext;
  nextHandle?: string | null;
  output?: Record<string, unknown>;
  status: "SUCCESS" | "FAILED" | "WAITING" | "SKIPPED";
  stop?: boolean;
};

function renderTemplateBody(
  body: string,
  templateKeys: string[],
  variables: string[],
) {
  const variableMap = new Map<string, string>();
  templateKeys.forEach((key, index) => {
    variableMap.set(key, variables[index] ?? "");
  });

  return renderPreview(body, Object.fromEntries(variableMap));
}

function normalizeMappingKey(value: string) {
  return value.trim().replace(/[{}]/g, "").toUpperCase();
}

function getNodeData(node: AutomationNode) {
  return asRecord(node.data);
}

function getReplyCandidates(context: AutomationContext) {
  const map = asRecord(context.variables.buttonReplyMap);
  const candidates = [
    context.trigger.buttonId,
    context.trigger.buttonText,
    context.trigger.listItemId,
    context.trigger.listItemText,
    context.trigger.text,
  ].filter((value): value is string => Boolean(value));

  const mapped = candidates
    .map((candidate) => map[candidate])
    .filter((value): value is string => typeof value === "string" && Boolean(value));

  return [...mapped, ...candidates].map((candidate) => normalizedText(candidate));
}

function getConditionValue(context: AutomationContext, variable: string) {
  const value = getAutomationContextValue(context, variable);
  if (value !== undefined) return value;

  return getAutomationContextValue(context, `variables.${variable}`);
}

function isEmptyValue(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function evaluateCondition({
  context,
  node,
}: {
  context: AutomationContext;
  node: AutomationNode;
}) {
  const data = getNodeData(node);
  const operator = stringValue(data.operator, "EQUALS");
  const actual = getConditionValue(context, stringValue(data.variable));
  const expected = data.value;
  const actualText = normalizedText(String(actual ?? ""));
  const expectedText = normalizedText(String(expected ?? ""));

  if (operator === "IS_EMPTY") return isEmptyValue(actual);
  if (operator === "IS_NOT_EMPTY") return !isEmptyValue(actual);
  if (operator === "NOT_EQUALS") return actualText !== expectedText;
  if (operator === "CONTAINS") return actualText.includes(expectedText);
  if (operator === "NOT_CONTAINS") return !actualText.includes(expectedText);
  if (operator === "GREATER_THAN") return Number(actual) > Number(expected);
  if (operator === "LESS_THAN") return Number(actual) < Number(expected);

  return actualText === expectedText;
}

async function createQueuedAutomationTemplateMessage({
  companyId,
  contact,
  context,
  executionId,
  node,
  sessionId,
}: AutomationNodeExecutionInput) {
  const data = getNodeData(node);
  const templateId = stringValue(data.templateId);
  const template = await prisma.template.findFirst({
    where: {
      companyId,
      id: templateId,
      status: "APPROVED",
    },
  });

  if (!template) {
    throw new Error("Approved template not found");
  }

  await assertContactCanReceiveTemplate({
    companyId,
    contactId: contact.id,
    templateCategory: template.category,
  });

  const allMappings = [
    ...(Array.isArray(data.headerVariableMappings)
      ? (data.headerVariableMappings as TemplateVariableMapping[])
      : []),
    ...(Array.isArray(data.bodyVariableMappings)
      ? (data.bodyVariableMappings as TemplateVariableMapping[])
      : []),
    ...(Array.isArray(data.buttonVariableMappings)
      ? (data.buttonVariableMappings as TemplateVariableMapping[])
      : []),
  ];
  const resolvedMappings = resolveTemplateMappings({
    contact,
    context,
    mappings: allMappings,
  });
  const valuesByKey = new Map<string, string>();

  resolvedMappings.forEach((mapping) => {
    valuesByKey.set(normalizeMappingKey(mapping.variableName), mapping.value);
    valuesByKey.set(
      normalizeMappingKey(`${mapping.component}_${mapping.index}`),
      mapping.value,
    );
  });

  if (stringValue(data.mediaUrl)) {
    valuesByKey.set("HEADER_MEDIA", stringValue(data.mediaUrl));
  }

  const templateKeys = (template.variables as string[]) || [];
  const variables = resolveAutomationVariables(templateKeys, valuesByKey);

  if (variables.length !== templateKeys.length) {
    throw new Error(`This template requires ${templateKeys.length} variable value(s)`);
  }

  if (variables.some((value) => !value.trim())) {
    throw new Error("Template variable mappings are incomplete");
  }

  const renderedBody = renderTemplateBody(template.body, templateKeys, variables);
  const unresolvedVariables = assertNoUnresolvedVariables(renderedBody);

  if (unresolvedVariables.length > 0) {
    throw new Error("Template preview contains unresolved variables");
  }

  return createQueuedAutomationOutboundMessage({
    body: renderedBody,
    companyId,
    contactId: contact.id,
    description: "Automation template message queued",
    executionId,
    metadata: {
      messageType: "TEMPLATE",
    },
    nodeId: node.id,
    sessionId,
    templateId: template.id,
    variables,
  });
}

export async function executeStartNode({
  context,
}: AutomationNodeExecutionInput): Promise<AutomationNodeExecutionResult> {
  return {
    context,
    nextHandle: "next",
    output: {
      trigger: context.trigger,
    },
    status: "SUCCESS",
  };
}

export async function executeSendMessageNode(
  input: AutomationNodeExecutionInput,
): Promise<AutomationNodeExecutionResult> {
  const data = getNodeData(input.node);
  const body = stringValue(data.messageText).trim();

  if (!body) {
    throw new Error("Send Message node requires message text");
  }

  const metadata: Record<string, unknown> = {};

  if (stringValue(data.mediaUrl)) {
    metadata.messageType = "MEDIA";
    metadata.mediaType = "IMAGE";
    metadata.mediaUrl = stringValue(data.mediaUrl);
    metadata.caption = body;
  }

  const outbound = await createQueuedAutomationOutboundMessage({
    body,
    companyId: input.companyId,
    contactId: input.contact.id,
    description: "Automation message queued",
    executionId: input.executionId,
    metadata,
    nodeId: input.node.id,
    sessionId: input.sessionId,
  });

  await setAutomationSessionLastOutboundMessage({
    messageId: outbound.id,
    sessionId: input.sessionId,
  });

  return {
    context: input.context,
    nextHandle: "next",
    output: {
      outboundMessageId: outbound.id,
    },
    status: "SUCCESS",
  };
}

export async function executeQuickReplyNode(
  input: AutomationNodeExecutionInput,
): Promise<AutomationNodeExecutionResult> {
  const data = getNodeData(input.node);
  const buttons = Array.isArray(data.buttons) ? data.buttons : [];
  const labels = buttons
    .map((button) => asRecord(button))
    .map((button) => stringValue(button.label).trim())
    .filter(Boolean)
    .slice(0, 3);

  if (!stringValue(data.bodyText).trim()) {
    throw new Error("Quick Reply node requires body text");
  }

  if (labels.length === 0) {
    throw new Error("Quick Reply node requires at least one button");
  }

  const buttonReplyMap: Record<string, string> = {};

  buttons.forEach((button, index) => {
    const record = asRecord(button);
    const buttonId = stringValue(record.id).trim();
    const label = stringValue(record.label).trim();

    if (buttonId) {
      buttonReplyMap[`reply_${index + 1}`] = buttonId;
      if (label) buttonReplyMap[label] = buttonId;
    }
  });

  const outbound = await createQueuedAutomationOutboundMessage({
    body: stringValue(data.bodyText),
    companyId: input.companyId,
    contactId: input.contact.id,
    description: "Automation quick reply queued",
    executionId: input.executionId,
    metadata: {
      body: stringValue(data.bodyText),
      buttons: labels,
      messageType: "INTERACTIVE",
      type: "Reply Button",
    },
    nodeId: input.node.id,
    sessionId: input.sessionId,
  });

  const context = setAutomationContextValue(
    input.context,
    "variables.buttonReplyMap",
    buttonReplyMap,
  );

  await setAutomationSessionLastOutboundMessage({
    messageId: outbound.id,
    sessionId: input.sessionId,
  });
  await markAutomationSessionWaiting({
    context,
    currentNodeId: input.node.id,
    sessionId: input.sessionId,
    waitingNodeId: input.node.id,
  });

  return {
    context,
    output: {
      buttons: buttonReplyMap,
      outboundMessageId: outbound.id,
    },
    status: "WAITING",
    stop: true,
  };
}

export async function executeSendTemplateNode(
  input: AutomationNodeExecutionInput,
): Promise<AutomationNodeExecutionResult> {
  const data = getNodeData(input.node);
  const templateId = stringValue(data.templateId);
  const template = await prisma.template.findFirst({
    where: {
      companyId: input.companyId,
      id: templateId,
      status: "APPROVED",
    },
  });

  if (!template) {
    throw new Error("Approved template not found");
  }

  const flowConfig = readFlowTemplateRuntimeConfig(template.components);

  if (flowConfig) {
    const allMappings = [
      ...(Array.isArray(data.headerVariableMappings)
        ? (data.headerVariableMappings as TemplateVariableMapping[])
        : []),
      ...(Array.isArray(data.bodyVariableMappings)
        ? (data.bodyVariableMappings as TemplateVariableMapping[])
        : []),
      ...(Array.isArray(data.buttonVariableMappings)
        ? (data.buttonVariableMappings as TemplateVariableMapping[])
        : []),
    ];
    const resolvedMappings = resolveTemplateMappings({
      contact: input.contact,
      context: input.context,
      mappings: allMappings,
    });
    const valuesByKey = new Map<string, string>();

    resolvedMappings.forEach((mapping) => {
      valuesByKey.set(normalizeMappingKey(mapping.variableName), mapping.value);
      valuesByKey.set(
        normalizeMappingKey(`${mapping.component}_${mapping.index}`),
        mapping.value,
      );
    });

    const templateKeys = (template.variables as string[]) || [];
    const variables = resolveAutomationVariables(templateKeys, valuesByKey);

    if (variables.length !== templateKeys.length) {
      throw new Error(`This template requires ${templateKeys.length} variable value(s)`);
    }

    if (variables.some((value) => !value.trim())) {
      throw new Error("Template variable mappings are incomplete");
    }

    const outbound = await createQueuedTemplateMessage(input.companyId, {
      automationContext: {
        executionId: input.executionId,
        nodeId: input.node.id,
        sessionId: input.sessionId,
        stepId: input.executionStepId ?? null,
      },
      contactId: input.contact.id,
      idempotencyKey: `automation:${input.executionId}:${input.node.id}:flow`,
      templateId: template.id,
      variables,
    });

    await setAutomationSessionLastOutboundMessage({
      messageId: outbound.id,
      sessionId: input.sessionId,
    });

    await markAutomationSessionWaiting({
      context: input.context,
      currentNodeId: input.node.id,
      sessionId: input.sessionId,
      waitingNodeId: input.node.id,
    });

    return {
      context: input.context,
      output: {
        flowInteractionId:
          asRecord(outbound.metadata).flowInteractionId ?? null,
        outboundMessageId: outbound.id,
        waitsFor: "WHATSAPP_FLOW_RESPONSE",
      },
      status: "WAITING",
      stop: true,
    };
  }

  const outbound = await createQueuedAutomationTemplateMessage(input);

  await setAutomationSessionLastOutboundMessage({
    messageId: outbound.id,
    sessionId: input.sessionId,
  });

  return {
    context: input.context,
    nextHandle: "sent",
    output: {
      outboundMessageId: outbound.id,
    },
    status: "SUCCESS",
  };
}

export async function executeWaitForReplyNode(
  input: AutomationNodeExecutionInput,
): Promise<AutomationNodeExecutionResult> {
  const data = getNodeData(input.node);
  const timeoutMinutes = Number(data.timeoutMinutes || 1440);
  const replyTimeoutAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);

  await markAutomationSessionWaiting({
    context: input.context,
    currentNodeId: input.node.id,
    replyTimeoutAt,
    sessionId: input.sessionId,
    waitingNodeId: input.node.id,
  });

  return {
    context: input.context,
    output: {
      replyTimeoutAt: replyTimeoutAt.toISOString(),
      saveReplyAs: stringValue(data.saveReplyAs, "reply"),
    },
    status: "WAITING",
    stop: true,
  };
}

export async function executeConditionNode(
  input: AutomationNodeExecutionInput,
): Promise<AutomationNodeExecutionResult> {
  const result = evaluateCondition({
    context: input.context,
    node: input.node,
  });

  return {
    context: input.context,
    nextHandle: result ? "true" : "false",
    output: {
      result,
    },
    status: "SUCCESS",
  };
}

export async function executeButtonReplyRouterNode(
  input: AutomationNodeExecutionInput,
): Promise<AutomationNodeExecutionResult> {
  const data = getNodeData(input.node);
  const routes = Array.isArray(data.routes) ? data.routes : [];
  const candidates = getReplyCandidates(input.context);
  const matchedRoute = routes
    .map((route) => asRecord(route))
    .find((route) => {
      const buttonId = normalizedText(stringValue(route.buttonId));
      const buttonLabel = normalizedText(stringValue(route.buttonLabel));

      return candidates.includes(buttonId) || candidates.includes(buttonLabel);
    });

  if (matchedRoute) {
    const buttonId = stringValue(matchedRoute.buttonId);

    return {
      context: input.context,
      nextHandle: `route:${buttonId}`,
      output: {
        buttonId,
        matched: true,
      },
      status: "SUCCESS",
    };
  }

  if (data.fallbackEnabled !== false) {
    return {
      context: input.context,
      nextHandle: "fallback",
      output: {
        matched: false,
      },
      status: "SUCCESS",
    };
  }

  throw new Error("Button reply did not match any route");
}

export async function executeAddTagNode(
  input: AutomationNodeExecutionInput,
): Promise<AutomationNodeExecutionResult> {
  const tagName = stringValue(getNodeData(input.node).tagName).trim();

  if (!tagName) {
    throw new Error("Add Tag node requires tag name");
  }

  const tag = await prisma.inboxTag.upsert({
    where: {
      companyId_name: {
        companyId: input.companyId,
        name: tagName,
      },
    },
    update: {},
    create: {
      color: "green",
      companyId: input.companyId,
      name: tagName,
    },
  });

  await prisma.contactInboxTag.upsert({
    where: {
      contactId_tagId: {
        contactId: input.contact.id,
        tagId: tag.id,
      },
    },
    update: {},
    create: {
      companyId: input.companyId,
      contactId: input.contact.id,
      tagId: tag.id,
    },
  });

  await recordContactActivity({
    companyId: input.companyId,
    contactId: input.contact.id,
    metadata: {
      automationExecutionId: input.executionId,
      nodeId: input.node.id,
      tagId: tag.id,
      tagName,
    },
    title: "Automation added tag",
    type: "TAG_ADDED",
  });

  return {
    context: input.context,
    nextHandle: "next",
    output: {
      tagId: tag.id,
      tagName,
    },
    status: "SUCCESS",
  };
}

export async function executeRemoveTagNode(
  input: AutomationNodeExecutionInput,
): Promise<AutomationNodeExecutionResult> {
  const tagName = stringValue(getNodeData(input.node).tagName).trim();

  if (!tagName) {
    throw new Error("Remove Tag node requires tag name");
  }

  const tag = await prisma.inboxTag.findUnique({
    where: {
      companyId_name: {
        companyId: input.companyId,
        name: tagName,
      },
    },
  });

  if (tag) {
    await prisma.contactInboxTag.deleteMany({
      where: {
        companyId: input.companyId,
        contactId: input.contact.id,
        tagId: tag.id,
      },
    });

    await recordContactActivity({
      companyId: input.companyId,
      contactId: input.contact.id,
      metadata: {
        automationExecutionId: input.executionId,
        nodeId: input.node.id,
        tagId: tag.id,
        tagName,
      },
      title: "Automation removed tag",
      type: "TAG_REMOVED",
    });
  }

  return {
    context: input.context,
    nextHandle: "next",
    output: {
      removed: Boolean(tag),
      tagName,
    },
    status: "SUCCESS",
  };
}

export async function executeUpdateContactFieldNode(
  input: AutomationNodeExecutionInput,
): Promise<AutomationNodeExecutionResult> {
  const data = getNodeData(input.node);
  const fieldName = stringValue(data.fieldName).trim();
  const fieldValue = stringValue(data.fieldValue);
  const allowedFields = new Set([
    "companyName",
    "email",
    "lifecycleStage",
    "name",
    "source",
  ]);

  if (fieldName.startsWith("customAttributes.")) {
    const context = setAutomationContextValue(
      input.context,
      `variables.${fieldName}`,
      fieldValue,
    );

    return {
      context,
      nextHandle: "next",
      output: {
        fieldName,
        persisted: false,
        value: fieldValue,
      },
      status: "SUCCESS",
    };
  }

  if (!allowedFields.has(fieldName)) {
    throw new Error(`Contact field "${fieldName}" is not allowed in automation`);
  }

  await prisma.contact.updateMany({
    where: {
      companyId: input.companyId,
      id: input.contact.id,
    },
    data: {
      [fieldName]: fieldValue,
    },
  });

  await recordContactActivity({
    companyId: input.companyId,
    contactId: input.contact.id,
    metadata: {
      automationExecutionId: input.executionId,
      fieldName,
      nodeId: input.node.id,
    },
    title: "Automation updated contact",
    type: "PROFILE_UPDATED",
  });

  const context = setAutomationContextValue(
    input.context,
    `contact.${fieldName}`,
    fieldValue,
  );

  return {
    context,
    nextHandle: "next",
    output: {
      fieldName,
      persisted: true,
      value: fieldValue,
    },
    status: "SUCCESS",
  };
}

function normalizeInboxPriority(value: unknown) {
  const priority = stringValue(value, "NORMAL").toUpperCase();

  if (priority === "MEDIUM") return "NORMAL";
  if (["LOW", "NORMAL", "HIGH", "URGENT"].includes(priority)) return priority;

  return "NORMAL";
}

export async function executeHumanHandoffNode(
  input: AutomationNodeExecutionInput,
): Promise<AutomationNodeExecutionResult> {
  const data = getNodeData(input.node);
  const assignedUserId =
    data.assignmentMode === "SPECIFIC_USER"
      ? stringValue(data.assignedUserId) || null
      : null;

  await prisma.contact.updateMany({
    where: {
      companyId: input.companyId,
      id: input.contact.id,
    },
    data: {
      assignedToUserId: assignedUserId,
      inboxPriority: normalizeInboxPriority(data.inboxPriority) as "LOW" | "NORMAL" | "HIGH" | "URGENT",
      inboxStatus: "OPEN",
    },
  });

  await recordContactActivity({
    companyId: input.companyId,
    contactId: input.contact.id,
    metadata: {
      assignedUserId,
      automationExecutionId: input.executionId,
      nodeId: input.node.id,
    },
    title: "Automation requested human handoff",
    type: assignedUserId ? "ASSIGNED" : "STATUS_CHANGED",
  });

  const messageToCustomer = stringValue(data.messageToCustomer).trim();
  let outboundMessageId: string | null = null;

  if (messageToCustomer) {
    const outbound = await createQueuedAutomationOutboundMessage({
      body: messageToCustomer,
      companyId: input.companyId,
      contactId: input.contact.id,
      description: "Automation handoff message queued",
      executionId: input.executionId,
      nodeId: input.node.id,
      sessionId: input.sessionId,
    });

    outboundMessageId = outbound.id;
    await setAutomationSessionLastOutboundMessage({
      messageId: outbound.id,
      sessionId: input.sessionId,
    });
  }

  await pauseAutomationSessionForHandoff(input.sessionId);

  return {
    context: input.context,
    output: {
      assignedUserId,
      outboundMessageId,
    },
    status: "SUCCESS",
    stop: true,
  };
}

export async function executeEndNode(
  input: AutomationNodeExecutionInput,
): Promise<AutomationNodeExecutionResult> {
  await completeAutomationSession(input.sessionId);

  return {
    context: input.context,
    output: {
      endReason: stringValue(getNodeData(input.node).endReason),
    },
    status: "SUCCESS",
    stop: true,
  };
}

export async function executeUnsupportedNode(
  nodeType: AutomationNodeType,
): Promise<AutomationNodeExecutionResult> {
  throw new Error(`Automation node type "${nodeType}" is not supported at runtime yet`);
}

export async function executeAutomationNode(
  input: AutomationNodeExecutionInput,
): Promise<AutomationNodeExecutionResult> {
  if (input.node.type === "START" || input.node.type === "TEMPLATE_TRIGGER") {
    return executeStartNode(input);
  }

  if (input.node.type === "SEND_MESSAGE") {
    return executeSendMessageNode(input);
  }

  if (input.node.type === "QUICK_REPLY") {
    return executeQuickReplyNode(input);
  }

  if (input.node.type === "SEND_TEMPLATE") {
    return executeSendTemplateNode(input);
  }

  if (input.node.type === "WAIT_FOR_REPLY") {
    return executeWaitForReplyNode(input);
  }

  if (input.node.type === "CONDITION") {
    return executeConditionNode(input);
  }

  if (input.node.type === "BUTTON_REPLY_ROUTER") {
    return executeButtonReplyRouterNode(input);
  }

  if (input.node.type === "ADD_TAG") {
    return executeAddTagNode(input);
  }

  if (input.node.type === "REMOVE_TAG") {
    return executeRemoveTagNode(input);
  }

  if (input.node.type === "UPDATE_CONTACT_FIELD") {
    return executeUpdateContactFieldNode(input);
  }

  if (input.node.type === "HUMAN_HANDOFF") {
    return executeHumanHandoffNode(input);
  }

  const advancedResult = await executeAdvancedAutomationNode(input);
  if (advancedResult) return advancedResult;

  if (input.node.type === "END") {
    return executeEndNode(input);
  }

  return executeUnsupportedNode(input.node.type);
}
