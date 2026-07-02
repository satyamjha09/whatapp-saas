import { prisma } from "@/lib/prisma";
import type {
  ApiHeader,
  AutomationColumnMapping,
  AutomationNode,
  AutomationValueSource,
} from "@/lib/automation-builder/types";
import { isAutomationNodeTypeEnabled } from "@/lib/automation-builder/feature-flags";
import {
  asRecord,
  getAutomationContextValue,
  setAutomationContextValue,
  stringValue,
} from "@/server/services/automation-context.service";
import { createQueuedAutomationOutboundMessage } from "@/server/services/automation-outbound-message.service";
import { executeAutomationWebhook } from "@/server/services/automation-webhook.service";
import {
  appendAutomationGoogleSheetRow,
  updateAutomationGoogleSheetRow,
} from "@/server/services/automation-google-sheet.service";
import { lookupAutomationTallyData } from "@/server/services/automation-tally.service";
import { createAutomationPaymentLink } from "@/server/services/automation-payment-link.service";
import { buildAutomationCatalogPreview } from "@/server/services/automation-catalog.service";
import { generateAutomationAiReply } from "@/server/services/automation-ai.service";
import { completeAutomationSession } from "@/server/services/automation-session.service";
import type {
  AutomationNodeExecutionInput,
  AutomationNodeExecutionResult,
} from "@/server/services/automation-node-executor.service";

function nodeData(node: AutomationNode) {
  return asRecord(node.data);
}

function getValueByPath(value: unknown, path: string) {
  const parts = path.split(".").filter(Boolean);
  let cursor = value;

  for (const part of parts) {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) {
      return undefined;
    }

    cursor = (cursor as Record<string, unknown>)[part];
  }

  return cursor;
}

function resolveValueSource({
  input,
  source,
}: {
  input: AutomationNodeExecutionInput;
  source: AutomationValueSource;
}) {
  let value: unknown;

  if (source.sourceType === "STATIC") {
    value = source.sourceValue;
  }

  if (source.sourceType === "CONTACT_FIELD") {
    value =
      input.contact[source.sourceValue as keyof typeof input.contact] ??
      getAutomationContextValue(input.context, `contact.${source.sourceValue}`);
  }

  if (source.sourceType === "SESSION_CONTEXT") {
    value = getAutomationContextValue(input.context, source.sourceValue);
  }

  if (source.sourceType === "PREVIOUS_NODE_OUTPUT") {
    value = getAutomationContextValue(input.context, `nodes.${source.sourceValue}`);
  }

  if (source.sourceType === "CUSTOM_ATTRIBUTE") {
    value = getAutomationContextValue(
      input.context,
      `variables.customAttributes.${source.sourceValue}`,
    );
  }

  if (value === undefined || value === null || value === "") {
    value = source.fallbackValue ?? "";
  }

  return value;
}

function buildMappedRow({
  input,
  mappings,
}: {
  input: AutomationNodeExecutionInput;
  mappings: AutomationColumnMapping[];
}) {
  return Object.fromEntries(
    mappings.map((mapping) => [
      mapping.columnName,
      resolveValueSource({
        input,
        source: mapping,
      }),
    ]),
  );
}

function applyResponseMappings({
  input,
  mappings,
  response,
}: {
  input: AutomationNodeExecutionInput;
  mappings: unknown;
  response: unknown;
}) {
  let context = input.context;

  if (!Array.isArray(mappings)) return context;

  mappings.forEach((mapping) => {
    const record = asRecord(mapping);
    const responsePath = stringValue(record.responsePath);
    const saveAs = stringValue(record.saveAs);

    if (!responsePath || !saveAs) return;

    context = setAutomationContextValue(
      context,
      `variables.${saveAs}`,
      getValueByPath(response, responsePath),
    );
  });

  return context;
}

function resolveAiMessageSource(input: AutomationNodeExecutionInput, data: Record<string, unknown>) {
  const source = asRecord(data.userMessageSource);
  const sourceType = stringValue(source.sourceType, "TRIGGER_MESSAGE");
  const sourceValue = stringValue(source.sourceValue, "trigger.text");

  if (sourceType === "STATIC") return sourceValue;
  if (sourceType === "TRIGGER_MESSAGE") return input.context.trigger.text;

  return getAutomationContextValue(input.context, sourceValue);
}

async function executeWebhookNode(
  input: AutomationNodeExecutionInput,
): Promise<AutomationNodeExecutionResult> {
  const data = nodeData(input.node);
  const retryCount = Number(data.retryCount ?? 0);
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      const response = await executeAutomationWebhook({
        body: stringValue(data.body),
        headers: Array.isArray(data.headers) ? (data.headers as ApiHeader[]) : [],
        method: stringValue(data.method, "POST") as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
        timeoutMs: Number(data.timeoutMs ?? 10000),
        url: stringValue(data.url),
      });

      if (!response.ok) {
        throw new Error(`Webhook returned HTTP ${response.status}`);
      }

      return {
        context: applyResponseMappings({
          input,
          mappings: data.responseMapping,
          response: response.body,
        }),
        nextHandle: "success",
        output: {
          attempts: attempt + 1,
          response: response.body,
          status: response.status,
        },
        status: "SUCCESS",
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Webhook failed");
}

async function executeGoogleSheetAppendRowNode(
  input: AutomationNodeExecutionInput,
): Promise<AutomationNodeExecutionResult> {
  const data = nodeData(input.node);
  const row = buildMappedRow({
    input,
    mappings: Array.isArray(data.columnMappings)
      ? (data.columnMappings as AutomationColumnMapping[])
      : [],
  });

  await appendAutomationGoogleSheetRow();

  return {
    context: input.context,
    nextHandle: "success",
    output: {
      row,
    },
    status: "SUCCESS",
  };
}

async function executeGoogleSheetUpdateRowNode(
  input: AutomationNodeExecutionInput,
): Promise<AutomationNodeExecutionResult> {
  const data = nodeData(input.node);
  const row = buildMappedRow({
    input,
    mappings: Array.isArray(data.updateMappings)
      ? (data.updateMappings as AutomationColumnMapping[])
      : [],
  });
  const lookupValue = resolveValueSource({
    input,
    source: asRecord(data.lookupValueSource) as AutomationValueSource,
  });

  await updateAutomationGoogleSheetRow();

  return {
    context: input.context,
    nextHandle: "success",
    output: {
      lookupColumn: stringValue(data.lookupColumn),
      lookupValue,
      row,
    },
    status: "SUCCESS",
  };
}

async function executeTallyLookupNode(
  input: AutomationNodeExecutionInput,
): Promise<AutomationNodeExecutionResult> {
  const data = nodeData(input.node);

  await lookupAutomationTallyData();

  return {
    context: input.context,
    nextHandle: "found",
    output: {
      lookupType: stringValue(data.lookupType),
    },
    status: "SUCCESS",
  };
}

async function executePaymentLinkNode(
  input: AutomationNodeExecutionInput,
): Promise<AutomationNodeExecutionResult> {
  const data = nodeData(input.node);

  await createAutomationPaymentLink();

  return {
    context: input.context,
    nextHandle: "created",
    output: {
      amount: resolveValueSource({
        input,
        source: asRecord(data.amountSource) as AutomationValueSource,
      }),
      provider: stringValue(data.provider, "CASHFREE"),
    },
    status: "SUCCESS",
  };
}

async function executeCatalogSendNode(
  input: AutomationNodeExecutionInput,
): Promise<AutomationNodeExecutionResult> {
  const data = nodeData(input.node);
  const productIds = Array.isArray(data.productIds)
    ? data.productIds.filter((productId): productId is string => typeof productId === "string")
    : [];
  const preview = buildAutomationCatalogPreview({
    catalogSource: stringValue(data.catalogSource),
    maxProducts: Number(data.maxProducts ?? 5),
    productIds,
  });
  const fallbackText =
    stringValue(data.fallbackText).trim() ||
    `Here are the product IDs: ${preview.productIds.join(", ")}`;
  const outbound = await createQueuedAutomationOutboundMessage({
    body: fallbackText,
    companyId: input.companyId,
    contactId: input.contact.id,
    description: "Automation catalog message queued",
    executionId: input.executionId,
    metadata: {
      catalog: preview,
      messageType: "CATALOG_PREVIEW",
    },
    nodeId: input.node.id,
    sessionId: input.sessionId,
  });

  return {
    context: input.context,
    nextHandle: "sent",
    output: {
      outboundMessageId: outbound.id,
      ...preview,
    },
    status: "SUCCESS",
  };
}

async function executeAiReplyNode(
  input: AutomationNodeExecutionInput,
): Promise<AutomationNodeExecutionResult> {
  const data = nodeData(input.node);
  const userMessage = resolveAiMessageSource(input, data);

  await generateAutomationAiReply();

  return {
    context: input.context,
    nextHandle: "answered",
    output: {
      userMessage,
    },
    status: "SUCCESS",
  };
}

async function executeFallbackNode(
  input: AutomationNodeExecutionInput,
): Promise<AutomationNodeExecutionResult> {
  const data = nodeData(input.node);
  const fallbackMessage = stringValue(data.fallbackMessage).trim();
  const nextAction = stringValue(data.nextAction, "SEND_MESSAGE");
  let outboundMessageId: string | null = null;

  if (fallbackMessage) {
    const outbound = await createQueuedAutomationOutboundMessage({
      body: fallbackMessage,
      companyId: input.companyId,
      contactId: input.contact.id,
      description: "Automation fallback message queued",
      executionId: input.executionId,
      nodeId: input.node.id,
      sessionId: input.sessionId,
    });
    outboundMessageId = outbound.id;
  }

  return {
    context: input.context,
    nextHandle:
      nextAction === "HUMAN_HANDOFF"
        ? "handoff"
        : nextAction === "END"
          ? "end"
          : "next",
    output: {
      nextAction,
      outboundMessageId,
    },
    status: "SUCCESS",
  };
}

function executeRetryNode(
  input: AutomationNodeExecutionInput,
): AutomationNodeExecutionResult {
  const data = nodeData(input.node);
  const path = `variables.retryCounts.${input.node.id}`;
  const previousCount = Number(getAutomationContextValue(input.context, path) ?? 0);
  const nextCount = previousCount + 1;
  const maxRetries = Number(data.maxRetries ?? 3);
  const context = setAutomationContextValue(input.context, path, nextCount);

  return {
    context,
    nextHandle: nextCount <= maxRetries ? "retry" : "max_retries_reached",
    output: {
      maxRetries,
      retryCount: nextCount,
      retryDelaySeconds: Number(data.retryDelaySeconds ?? 0),
      retryTargetNodeId: stringValue(data.retryTargetNodeId),
    },
    status: "SUCCESS",
  };
}

async function executeErrorHandlerNode(
  input: AutomationNodeExecutionInput,
): Promise<AutomationNodeExecutionResult> {
  const data = nodeData(input.node);
  const message = stringValue(data.errorMessageToCustomer).trim();
  let outboundMessageId: string | null = null;

  if (data.openInbox === true) {
    await prisma.contact.updateMany({
      where: {
        companyId: input.companyId,
        id: input.contact.id,
      },
      data: {
        inboxPriority: "HIGH",
        inboxStatus: "OPEN",
      },
    });
  }

  if (message) {
    const outbound = await createQueuedAutomationOutboundMessage({
      body: message,
      companyId: input.companyId,
      contactId: input.contact.id,
      description: "Automation error handler message queued",
      executionId: input.executionId,
      nodeId: input.node.id,
      sessionId: input.sessionId,
    });
    outboundMessageId = outbound.id;
  }

  if (data.endSession === true) {
    await completeAutomationSession(input.sessionId);
  }

  return {
    context: input.context,
    nextHandle: data.endSession === true ? null : "handled",
    output: {
      endSession: data.endSession === true,
      notifyTeam: data.notifyTeam === true,
      openInbox: data.openInbox === true,
      outboundMessageId,
    },
    status: "SUCCESS",
    stop: data.endSession === true,
  };
}

export async function executeAdvancedAutomationNode(
  input: AutomationNodeExecutionInput,
): Promise<AutomationNodeExecutionResult | null> {
  if (!isAutomationNodeTypeEnabled(input.node.type)) {
    throw new Error(`Automation node type "${input.node.type}" is disabled`);
  }

  if (input.node.type === "WEBHOOK") return executeWebhookNode(input);
  if (input.node.type === "GOOGLE_SHEET_APPEND_ROW") {
    return executeGoogleSheetAppendRowNode(input);
  }
  if (input.node.type === "GOOGLE_SHEET_UPDATE_ROW") {
    return executeGoogleSheetUpdateRowNode(input);
  }
  if (input.node.type === "TALLY_LOOKUP") return executeTallyLookupNode(input);
  if (input.node.type === "PAYMENT_LINK") return executePaymentLinkNode(input);
  if (input.node.type === "CATALOG_SEND") return executeCatalogSendNode(input);
  if (input.node.type === "AI_REPLY") return executeAiReplyNode(input);
  if (input.node.type === "FALLBACK") return executeFallbackNode(input);
  if (input.node.type === "RETRY") return executeRetryNode(input);
  if (input.node.type === "ERROR_HANDLER") return executeErrorHandlerNode(input);

  return null;
}
