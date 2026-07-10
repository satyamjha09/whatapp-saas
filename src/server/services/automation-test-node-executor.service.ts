import { prisma } from "@/lib/prisma";
import {
  assertNoUnresolvedVariables,
  renderPreview as renderTemplatePreview,
} from "@/lib/whatsapp-template/template-variable-engine";
import type {
  AutomationColumnMapping,
  AutomationNode,
  AutomationValueSource,
  TemplateVariableMapping,
} from "@/lib/automation-builder/types";
import {
  addNodeOutput,
  asRecord,
  getTestContextValue,
  resolveTestValue,
  setTestContextValue,
  stringValue,
  type AutomationTestContext,
} from "@/server/services/automation-test-context.service";

export type AutomationTestNodeExecutionInput = {
  companyId: string;
  context: AutomationTestContext;
  node: AutomationNode;
};

export type AutomationTestNodeExecutionResult = {
  context: AutomationTestContext;
  nextHandle?: string | null;
  output?: Record<string, unknown>;
  status: "SUCCESS" | "FAILED" | "WAITING" | "SKIPPED";
  stop?: boolean;
};

function nodeData(node: AutomationNode) {
  return asRecord(node.data);
}

function normalized(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function isEmpty(value: unknown) {
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
  context: AutomationTestContext;
  node: AutomationNode;
}) {
  const data = nodeData(node);
  const variable = stringValue(data.variable);
  const operator = stringValue(data.operator, "EQUALS");
  const actual =
    getTestContextValue(context, variable) ??
    getTestContextValue(context, `variables.${variable}`) ??
    getTestContextValue(context, `replies.${variable}`);
  const expected = data.value;
  const actualText = normalized(actual);
  const expectedText = normalized(expected);

  if (operator === "IS_EMPTY") return { actual, result: isEmpty(actual) };
  if (operator === "IS_NOT_EMPTY") return { actual, result: !isEmpty(actual) };
  if (operator === "NOT_EQUALS") {
    return { actual, result: actualText !== expectedText };
  }
  if (operator === "CONTAINS") {
    return { actual, result: actualText.includes(expectedText) };
  }
  if (operator === "NOT_CONTAINS") {
    return { actual, result: !actualText.includes(expectedText) };
  }
  if (operator === "GREATER_THAN") {
    return { actual, result: Number(actual) > Number(expected) };
  }
  if (operator === "LESS_THAN") {
    return { actual, result: Number(actual) < Number(expected) };
  }

  return { actual, result: actualText === expectedText };
}

function resolveMappings(
  mappings: unknown,
  context: AutomationTestContext,
) {
  return (Array.isArray(mappings) ? mappings : [])
    .map((mapping) => mapping as TemplateVariableMapping)
    .map((mapping) => ({
      ...mapping,
      value: resolveTestValue(mapping, context),
    }));
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

function applyResponseMappings({
  context,
  mappings,
  response,
}: {
  context: AutomationTestContext;
  mappings: unknown;
  response: unknown;
}) {
  let nextContext = context;

  if (!Array.isArray(mappings)) return nextContext;

  mappings.forEach((mapping) => {
    const record = asRecord(mapping);
    const responsePath = stringValue(record.responsePath);
    const saveAs = stringValue(record.saveAs);

    if (!responsePath || !saveAs) return;

    nextContext = setTestContextValue(
      nextContext,
      `variables.${saveAs}`,
      getValueByPath(response, responsePath),
    );
  });

  return nextContext;
}

function resolveValueSource(
  source: AutomationValueSource,
  context: AutomationTestContext,
) {
  let value: unknown;

  if (source.sourceType === "STATIC") {
    value = source.sourceValue;
  }

  if (source.sourceType === "CONTACT_FIELD") {
    value = getTestContextValue(context, `contact.${source.sourceValue}`);
  }

  if (source.sourceType === "SESSION_CONTEXT") {
    value = getTestContextValue(context, source.sourceValue);
  }

  if (source.sourceType === "PREVIOUS_NODE_OUTPUT") {
    value = getTestContextValue(context, `nodes.${source.sourceValue}`);
  }

  if (source.sourceType === "CUSTOM_ATTRIBUTE") {
    value = getTestContextValue(
      context,
      `contact.customAttributes.${source.sourceValue}`,
    );
  }

  if (value === undefined || value === null || value === "") {
    value = source.fallbackValue ?? "";
  }

  return value;
}

function buildMappedRow({
  context,
  mappings,
}: {
  context: AutomationTestContext;
  mappings: AutomationColumnMapping[];
}) {
  return Object.fromEntries(
    mappings.map((mapping) => [
      mapping.columnName,
      resolveValueSource(mapping, context),
    ]),
  );
}

function resolveAiUserMessage(
  data: Record<string, unknown>,
  context: AutomationTestContext,
) {
  const source = asRecord(data.userMessageSource);
  const sourceType = stringValue(source.sourceType, "TRIGGER_MESSAGE");
  const sourceValue = stringValue(source.sourceValue, "trigger.text");

  if (sourceType === "STATIC") return sourceValue;
  if (sourceType === "TRIGGER_MESSAGE") return context.trigger.text ?? "";

  return getTestContextValue(context, sourceValue);
}

function renderPreview(templateBody: string, resolvedVariables: Record<string, string>) {
  return renderTemplatePreview(templateBody, resolvedVariables);
}

export async function executeAutomationTestNode({
  companyId,
  context,
  node,
}: AutomationTestNodeExecutionInput): Promise<AutomationTestNodeExecutionResult> {
  const data = nodeData(node);

  if (node.type === "START" || node.type === "TEMPLATE_TRIGGER") {
    return {
      context,
      nextHandle: "next",
      output: {
        dryRun: true,
        trigger: context.trigger,
      },
      status: "SUCCESS",
    };
  }

  if (node.type === "SEND_MESSAGE") {
    const body = stringValue(data.messageText).trim();
    if (!body) throw new Error("Send Message node is missing message text.");

    return {
      context,
      nextHandle: "next",
      output: {
        body,
        mediaUrl: stringValue(data.mediaUrl) || null,
        messageType: stringValue(data.mediaUrl) ? "media" : "text",
        simulated: true,
      },
      status: "SUCCESS",
    };
  }

  if (node.type === "QUICK_REPLY") {
    const bodyText = stringValue(data.bodyText).trim();
    const buttons = Array.isArray(data.buttons) ? data.buttons.map(asRecord) : [];

    if (!bodyText) throw new Error("Quick Reply node is missing body text.");
    if (buttons.length === 0) {
      throw new Error("Quick Reply node needs at least one button.");
    }

    return {
      context,
      output: {
        bodyText,
        buttons: buttons.map((button) => ({
          id: stringValue(button.id),
          label: stringValue(button.label),
        })),
        messageType: "quick_reply",
        simulated: true,
      },
      status: "WAITING",
      stop: true,
    };
  }

  if (node.type === "LIST_MESSAGE") {
    const bodyText = stringValue(data.bodyText).trim();
    const sections = Array.isArray(data.sections) ? data.sections : [];

    if (!bodyText) throw new Error("List Message node is missing body text.");
    if (sections.length === 0) {
      throw new Error("List Message node needs at least one list item.");
    }

    return {
      context,
      output: {
        bodyText,
        buttonText: stringValue(data.buttonText, "View options"),
        messageType: "list",
        sections,
        simulated: true,
      },
      status: "WAITING",
      stop: true,
    };
  }

  if (node.type === "SEND_TEMPLATE") {
    const templateId = stringValue(data.templateId);
    if (!templateId) {
      throw new Error("Send Template node is missing template selection.");
    }

    const template = await prisma.template.findFirst({
      where: {
        companyId,
        id: templateId,
      },
      select: {
        body: true,
        language: true,
        name: true,
        status: true,
        variables: true,
      },
    });

    if (!template) {
      throw new Error("Selected template was not found for this workspace.");
    }

    if (template.status !== "APPROVED") {
      throw new Error("Only approved WhatsApp templates can be tested here.");
    }

    const resolved = [
      ...resolveMappings(data.headerVariableMappings, context),
      ...resolveMappings(data.bodyVariableMappings, context),
      ...resolveMappings(data.buttonVariableMappings, context),
    ];
    const resolvedVariables = new Map(
      resolved.map((mapping) => [mapping.variableName, mapping.value]),
    );
    const previewVariables = Object.fromEntries(resolvedVariables);
    const missing = template.variables.filter(
      (variable) => !stringValue(resolvedVariables.get(variable)).trim(),
    );

    if (missing.length > 0) {
      throw new Error(
        `Template variable mapping is missing: ${missing.join(", ")}`,
      );
    }

    const preview = renderPreview(template.body, previewVariables);
    const unresolvedVariables = assertNoUnresolvedVariables(preview);

    if (unresolvedVariables.length > 0) {
      throw new Error("Template preview contains unresolved variables.");
    }

    return {
      context,
      nextHandle: "sent",
      output: {
        languageCode: stringValue(data.languageCode, template.language),
        messageType: "template",
        preview,
        resolvedVariables: previewVariables,
        simulated: true,
        templateId,
        templateName: stringValue(data.templateName, template.name),
      },
      status: "SUCCESS",
    };
  }

  if (node.type === "WAIT_FOR_REPLY") {
    return {
      context,
      output: {
        acceptedReplyType: stringValue(data.acceptedReplyType, "ANY"),
        saveReplyAs: stringValue(data.saveReplyAs, "last_reply"),
        timeoutMinutes: Number(data.timeoutMinutes || 1440),
      },
      status: "WAITING",
      stop: true,
    };
  }

  if (node.type === "CONDITION") {
    const { actual, result } = evaluateCondition({
      context,
      node,
    });

    return {
      context,
      nextHandle: result ? "true" : "false",
      output: {
        actualValue: actual ?? null,
        expectedValue: data.value ?? null,
        operator: stringValue(data.operator),
        result,
        variable: stringValue(data.variable),
      },
      status: "SUCCESS",
    };
  }

  if (node.type === "BUTTON_REPLY_ROUTER") {
    const routes = Array.isArray(data.routes) ? data.routes.map(asRecord) : [];
    const reply = normalized(
      context.trigger.buttonId ?? context.trigger.text ?? "",
    );
    const matchedRoute = routes.find((route) => {
      return (
        normalized(route.buttonId) === reply ||
        normalized(route.buttonLabel) === reply
      );
    });

    if (matchedRoute) {
      const buttonId = stringValue(matchedRoute.buttonId);

      return {
        context,
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
        context,
        nextHandle: "fallback",
        output: {
          matched: false,
          reason: "No matching button route; fallback path selected.",
        },
        status: "SUCCESS",
      };
    }

    throw new Error("Button reply did not match any configured route.");
  }

  if (node.type === "API_CALL") {
    const mockResponse =
      data.mockResponse !== undefined ? data.mockResponse : undefined;

    if (mockResponse !== undefined) {
      const nextContext = applyResponseMappings({
        context,
        mappings: data.responseMapping,
        response: mockResponse,
      });

      return {
        context: nextContext,
        nextHandle: "success",
        output: {
          mockResponse,
          simulated: true,
        },
        status: "SUCCESS",
      };
    }

    return {
      context,
      nextHandle: "success",
      output: {
        message:
          "API call skipped in dry run. Add mockResponse to test this node.",
        simulated: true,
        skippedExternalCall: true,
      },
      status: "SKIPPED",
    };
  }

  if (node.type === "WEBHOOK") {
    const mockResponse =
      data.mockResponse !== undefined
        ? data.mockResponse
        : {
            ok: true,
            simulated: true,
          };
    const nextContext = applyResponseMappings({
      context,
      mappings: data.responseMapping,
      response: mockResponse,
    });

    return {
      context: nextContext,
      nextHandle: "success",
      output: {
        method: stringValue(data.method, "POST"),
        mockResponse,
        simulated: true,
        skippedExternalCall: true,
        url: stringValue(data.url),
      },
      status: "SUCCESS",
    };
  }

  if (node.type === "GOOGLE_SHEET_APPEND_ROW") {
    const row = buildMappedRow({
      context,
      mappings: Array.isArray(data.columnMappings)
        ? (data.columnMappings as AutomationColumnMapping[])
        : [],
    });

    return {
      context,
      nextHandle: "success",
      output: {
        row,
        sheetName: stringValue(data.sheetName),
        simulated: true,
        skippedExternalCall: true,
        spreadsheetId: stringValue(data.spreadsheetId),
      },
      status: "SUCCESS",
    };
  }

  if (node.type === "GOOGLE_SHEET_UPDATE_ROW") {
    const row = buildMappedRow({
      context,
      mappings: Array.isArray(data.updateMappings)
        ? (data.updateMappings as AutomationColumnMapping[])
        : [],
    });
    const lookupValue = resolveValueSource(
      asRecord(data.lookupValueSource) as AutomationValueSource,
      context,
    );

    return {
      context,
      nextHandle: "success",
      output: {
        lookupColumn: stringValue(data.lookupColumn),
        lookupValue,
        row,
        sheetName: stringValue(data.sheetName),
        simulated: true,
        skippedExternalCall: true,
        spreadsheetId: stringValue(data.spreadsheetId),
      },
      status: "SUCCESS",
    };
  }

  if (node.type === "TALLY_LOOKUP") {
    const mockResult =
      data.mockResult !== undefined
        ? data.mockResult
        : {
            balance: "12500.00",
            currency: "INR",
            found: true,
          };
    const resultRecord = asRecord(mockResult);
    const nextContext = setTestContextValue(
      context,
      `variables.${stringValue(data.saveResultAs, "tallyResult")}`,
      mockResult,
    );

    return {
      context: nextContext,
      nextHandle: resultRecord.found === false ? "not_found" : "found",
      output: {
        lookupType: stringValue(data.lookupType),
        result: mockResult,
        simulated: true,
        skippedExternalCall: true,
      },
      status: "SUCCESS",
    };
  }

  if (node.type === "PAYMENT_LINK") {
    const amount = resolveValueSource(
      asRecord(data.amountSource) as AutomationValueSource,
      context,
    );
    const paymentLink =
      stringValue(data.mockPaymentLink) ||
      `https://payments.test/metawhat/${node.id}`;
    const nextContext = setTestContextValue(
      context,
      `variables.${stringValue(data.savePaymentLinkAs, "paymentLink")}`,
      paymentLink,
    );

    return {
      context: nextContext,
      nextHandle: "created",
      output: {
        amount,
        paymentLink,
        provider: stringValue(data.provider, "CASHFREE"),
        simulated: true,
        skippedExternalCall: true,
      },
      status: "SUCCESS",
    };
  }

  if (node.type === "CATALOG_SEND") {
    const productIds = Array.isArray(data.productIds)
      ? data.productIds.filter((productId): productId is string => typeof productId === "string")
      : [];

    return {
      context,
      nextHandle: "sent",
      output: {
        catalogSource: stringValue(data.catalogSource),
        maxProducts: Number(data.maxProducts ?? 5),
        productIds: productIds.slice(0, Number(data.maxProducts ?? 5)),
        simulated: true,
      },
      status: "SUCCESS",
    };
  }

  if (node.type === "AI_REPLY") {
    const mockResponse = asRecord(data.mockResponse);
    const confidence = Number(mockResponse.confidence ?? 0.85);
    const reply =
      stringValue(mockResponse.text) ||
      "Thanks for your message. Our team can help you with this.";
    const saveAs = stringValue(data.saveReplyAs, "aiReply");
    const nextContext = setTestContextValue(context, `variables.${saveAs}`, reply);
    const threshold = Number(data.confidenceThreshold ?? 0.7);

    return {
      context: nextContext,
      nextHandle: confidence >= threshold ? "answered" : "low_confidence",
      output: {
        confidence,
        reply,
        simulated: true,
        skippedExternalCall: true,
        userMessage: resolveAiUserMessage(data, context),
      },
      status: "SUCCESS",
    };
  }

  if (node.type === "FALLBACK") {
    const nextAction = stringValue(data.nextAction, "SEND_MESSAGE");

    return {
      context,
      nextHandle:
        nextAction === "HUMAN_HANDOFF"
          ? "handoff"
          : nextAction === "END"
            ? "end"
            : "next",
      output: {
        fallbackMessage: stringValue(data.fallbackMessage),
        nextAction,
        simulated: true,
      },
      status: "SUCCESS",
    };
  }

  if (node.type === "RETRY") {
    const path = `variables.retryCounts.${node.id}`;
    const previousCount = Number(getTestContextValue(context, path) ?? 0);
    const retryCount = previousCount + 1;
    const maxRetries = Number(data.maxRetries ?? 3);

    return {
      context: setTestContextValue(context, path, retryCount),
      nextHandle: retryCount <= maxRetries ? "retry" : "max_retries_reached",
      output: {
        maxRetries,
        retryCount,
        retryDelaySeconds: Number(data.retryDelaySeconds ?? 0),
        retryTargetNodeId: stringValue(data.retryTargetNodeId),
        simulated: true,
        skippedDelay: true,
      },
      status: "SUCCESS",
    };
  }

  if (node.type === "ERROR_HANDLER") {
    return {
      context,
      nextHandle: data.endSession === true ? null : "handled",
      output: {
        endSession: data.endSession === true,
        errorMessageToCustomer: stringValue(data.errorMessageToCustomer),
        notifyTeam: data.notifyTeam === true,
        openInbox: data.openInbox === true,
        simulated: true,
      },
      status: "SUCCESS",
      stop: data.endSession === true,
    };
  }

  if (node.type === "HUMAN_HANDOFF") {
    return {
      context,
      output: {
        action: "human_handoff",
        assignmentMode: stringValue(data.assignmentMode),
        inboxPriority: stringValue(data.inboxPriority),
        messageToCustomer: stringValue(data.messageToCustomer),
        simulated: true,
      },
      status: "SUCCESS",
      stop: true,
    };
  }

  if (node.type === "ADD_TAG") {
    const tagName = stringValue(data.tagName).trim();
    if (!tagName) throw new Error("Add Tag node is missing tag name.");

    const tags = new Set(context.contact.tags);
    tags.add(tagName);

    return {
      context: {
        ...context,
        contact: {
          ...context.contact,
          tags: [...tags],
        },
      },
      nextHandle: "next",
      output: {
        simulated: true,
        tagName,
      },
      status: "SUCCESS",
    };
  }

  if (node.type === "REMOVE_TAG") {
    const tagName = stringValue(data.tagName).trim();
    const tags = context.contact.tags.filter((tag) => tag !== tagName);

    return {
      context: {
        ...context,
        contact: {
          ...context.contact,
          tags,
        },
      },
      nextHandle: "next",
      output: {
        simulated: true,
        tagName,
      },
      status: "SUCCESS",
    };
  }

  if (node.type === "UPDATE_CONTACT_FIELD") {
    const fieldName = stringValue(data.fieldName).trim();
    const fieldValue = stringValue(data.fieldValue);

    if (!fieldName) throw new Error("Update Contact Field is missing field name.");

    const contextPath = fieldName.startsWith("customAttributes.")
      ? `contact.${fieldName}`
      : `contact.${fieldName}`;

    return {
      context: setTestContextValue(context, contextPath, fieldValue),
      nextHandle: "next",
      output: {
        fieldName,
        fieldValue,
        simulated: true,
      },
      status: "SUCCESS",
    };
  }

  if (node.type === "DELAY") {
    return {
      context,
      nextHandle: "next",
      output: {
        duration: data.duration,
        simulated: true,
        skippedDelay: true,
        unit: data.unit,
      },
      status: "SUCCESS",
    };
  }

  if (node.type === "END") {
    return {
      context,
      output: {
        endReason: stringValue(data.endReason, "Completed"),
      },
      status: "SUCCESS",
      stop: true,
    };
  }

  if (data.mockOutput !== undefined) {
    return {
      context: addNodeOutput(context, node.id, data.mockOutput),
      nextHandle: "next",
      output: {
        mockOutput: data.mockOutput,
        simulated: true,
      },
      status: "SUCCESS",
    };
  }

  return {
    context,
    output: {
      message: "This node is not supported in dry-run test yet.",
      simulated: true,
    },
    status: "SKIPPED",
    stop: true,
  };
}
