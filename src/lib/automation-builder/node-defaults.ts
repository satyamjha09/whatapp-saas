import {
  isAutomationNodeType,
  type ApiHeader,
  type ApiResponseMapping,
  type AutomationColumnMapping,
  type AutomationEdge,
  type AutomationGraph,
  type AutomationNode,
  type AutomationNodeData,
  type AutomationNodeType,
  type AutomationValueSource,
  type ButtonReplyRoute,
  type ListMessageSection,
  type QuickReplyButton,
  type TemplateVariableMapping,
} from "@/lib/automation-builder/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function readScalar(
  value: unknown,
): string | number | boolean | undefined {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  return undefined;
}

function readStringArray(value: unknown, fallback: string[]) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : fallback;
}

function readBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function parseJsonValue(value: unknown) {
  if (typeof value !== "string") return value;
  if (!value.trim()) return undefined;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseArray<T>(
  value: unknown,
  mapper: (item: unknown) => T | null,
  fallback: T[],
) {
  let source = value;

  if (typeof value === "string" && value.trim()) {
    try {
      source = JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  if (!Array.isArray(source)) return fallback;

  const items = source
    .map((item) => mapper(item))
    .filter((item): item is T => Boolean(item));

  return items.length > 0 ? items : fallback;
}

function normalizeConditionOperator(value: unknown) {
  const operator = readString(value, "EQUALS").toUpperCase();
  const map: Record<string, string> = {
    CONTAINS: "CONTAINS",
    ENDS_WITH: "CONTAINS",
    EQUALS: "EQUALS",
    EXISTS: "IS_NOT_EMPTY",
    GREATER_THAN: "GREATER_THAN",
    IS_EMPTY: "IS_EMPTY",
    IS_NOT_EMPTY: "IS_NOT_EMPTY",
    LESS_THAN: "LESS_THAN",
    NOT_CONTAINS: "NOT_CONTAINS",
    NOT_EQUALS: "NOT_EQUALS",
    STARTS_WITH: "CONTAINS",
  };

  return (map[operator] ?? "EQUALS") as Extract<
    AutomationNodeData,
    { operator: unknown }
  >["operator"];
}

function normalizeTemplateComponent(value: unknown) {
  const component = readString(value, "BODY").toUpperCase();

  return ["HEADER", "BODY", "BUTTON"].includes(component)
    ? (component as TemplateVariableMapping["component"])
    : "BODY";
}

function normalizeTemplateSourceType(value: unknown) {
  const sourceType = readString(value, "STATIC").toUpperCase();

  return [
    "CONTACT_FIELD",
    "STATIC",
    "SESSION_CONTEXT",
    "PREVIOUS_NODE_OUTPUT",
    "CUSTOM_ATTRIBUTE",
  ].includes(sourceType)
    ? (sourceType as TemplateVariableMapping["sourceType"])
    : "STATIC";
}

function normalizeValueSource(
  value: unknown,
  fallback: AutomationValueSource = {
    sourceType: "STATIC",
    sourceValue: "",
  },
): AutomationValueSource {
  let source = value;

  if (typeof value === "string" && value.trim()) {
    try {
      source = JSON.parse(value);
    } catch {
      return {
        ...fallback,
        sourceValue: value,
      };
    }
  }

  const record = isRecord(source) ? source : {};

  return {
    fallbackValue: readString(record.fallbackValue, fallback.fallbackValue).trim() || undefined,
    sourceType: normalizeTemplateSourceType(record.sourceType ?? fallback.sourceType),
    sourceValue: readString(record.sourceValue, fallback.sourceValue).trim(),
  };
}

function normalizeAiMessageSource(value: unknown) {
  let source = value;

  if (typeof value === "string" && value.trim()) {
    try {
      source = JSON.parse(value);
    } catch {
      return {
        sourceType: "STATIC" as const,
        sourceValue: value,
      };
    }
  }

  const record = isRecord(source) ? source : {};
  const sourceType = readString(record.sourceType, "TRIGGER_MESSAGE").toUpperCase();

  return {
    sourceType: [
      "TRIGGER_MESSAGE",
      "SESSION_CONTEXT",
      "PREVIOUS_NODE_OUTPUT",
      "STATIC",
    ].includes(sourceType)
      ? (sourceType as "TRIGGER_MESSAGE" | "SESSION_CONTEXT" | "PREVIOUS_NODE_OUTPUT" | "STATIC")
      : "TRIGGER_MESSAGE",
    sourceValue: readString(record.sourceValue, "trigger.text").trim(),
  };
}

function normalizeHeaderType(value: unknown) {
  const headerType = readString(value, "NONE").toUpperCase();

  return ["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"].includes(headerType)
    ? (headerType as Extract<
        AutomationNodeData,
        { headerType?: unknown }
      >["headerType"])
    : "NONE";
}

function normalizeTemplateMappings(
  value: unknown,
  component: TemplateVariableMapping["component"],
): TemplateVariableMapping[] {
  return parseArray<TemplateVariableMapping>(
    value,
    (item) => {
      if (!isRecord(item)) return null;

      const variableName = readString(item.variableName).trim();
      const sourceValue = readString(item.sourceValue).trim();

      if (!variableName) return null;

      return {
        component: normalizeTemplateComponent(item.component ?? component),
        fallbackValue: readString(item.fallbackValue).trim() || undefined,
        index: readNumber(item.index, 0),
        variableName,
        sourceType: normalizeTemplateSourceType(item.sourceType),
        sourceValue,
      };
    },
    [],
  );
}

function normalizeButtonReplyRoutes(value: unknown): ButtonReplyRoute[] {
  return parseArray<ButtonReplyRoute>(
    value,
    (item) => {
      if (!isRecord(item)) return null;

      const buttonId = readString(item.buttonId).trim();
      const buttonLabel = readString(item.buttonLabel).trim();

      if (!buttonId || !buttonLabel) return null;

      return {
        buttonId,
        buttonLabel,
      };
    },
    [],
  );
}

function normalizeHeaders(value: unknown): ApiHeader[] {
  return parseArray<ApiHeader>(
    value,
    (item) => {
      if (!isRecord(item)) return null;

      const key = readString(item.key).trim();
      const mappedValue = readString(item.value).trim();

      if (!key || !mappedValue) return null;

      return {
        key,
        secret: readBoolean(item.secret, false),
        value: mappedValue,
      };
    },
    [],
  );
}

function normalizeColumnMappings(value: unknown): AutomationColumnMapping[] {
  return parseArray<AutomationColumnMapping>(
    value,
    (item) => {
      if (!isRecord(item)) return null;

      const columnName = readString(item.columnName).trim();
      const sourceValue = readString(item.sourceValue).trim();

      if (!columnName || !sourceValue) return null;

      return {
        columnName,
        fallbackValue: readString(item.fallbackValue).trim() || undefined,
        sourceType: normalizeTemplateSourceType(item.sourceType),
        sourceValue,
      };
    },
    [],
  );
}

function normalizeResponseMappings(value: unknown): ApiResponseMapping[] {
  return parseArray<ApiResponseMapping>(
    value,
    (item) => {
      if (!isRecord(item)) return null;

      const responsePath = readString(item.responsePath).trim();
      const saveAs = readString(item.saveAs).trim();

      if (!responsePath || !saveAs) return null;

      return {
        responsePath,
        saveAs,
      };
    },
    [],
  );
}

function normalizeButtons(value: unknown): QuickReplyButton[] {
  return parseArray<QuickReplyButton>(
    value,
    (item) => {
      if (!isRecord(item)) return null;

      const id = readString(item.id).trim();
      const label = readString(item.label).trim();

      if (!id || !label) return null;

      return {
        id,
        label,
      };
    },
    [
      { id: "option_1", label: "Option 1" },
      { id: "option_2", label: "Option 2" },
    ],
  );
}

function normalizeSections(value: unknown): ListMessageSection[] {
  return parseArray<ListMessageSection>(
    value,
    (section) => {
      if (!isRecord(section)) return null;

      const id = readString(section.id, "section_1").trim();
      const title = readString(section.title).trim();
      const items = parseArray(
        section.items,
        (item) => {
          if (!isRecord(item)) return null;

          const itemId = readString(item.id).trim();
          const itemTitle = readString(item.title).trim();

          if (!itemId || !itemTitle) return null;

          return {
            description: readString(item.description) || undefined,
            id: itemId,
            title: itemTitle,
          };
        },
        [],
      );

      if (!title || items.length === 0) return null;

      return {
        id,
        items,
        title,
      };
    },
    [
      {
        id: "main",
        title: "Main options",
        items: [
          {
            description: "Talk to sales",
            id: "sales",
            title: "Sales",
          },
          {
            description: "Get support",
            id: "support",
            title: "Support",
          },
        ],
      },
    ],
  );
}

export function createDefaultNodeData(
  type: AutomationNodeType,
): AutomationNodeData {
  if (type === "START") {
    return {
      keywords: ["hi", "hello"],
      label: "Start",
      triggerType: "KEYWORD",
    };
  }

  if (type === "TEMPLATE_TRIGGER") {
    return {
      buttonIds: [],
      keywords: [],
      label: "Template Reply Trigger",
      triggerMode: "ANY_TEMPLATE_REPLY",
      triggerName: "Template reply received",
    };
  }

  if (type === "SEND_MESSAGE") {
    return {
      label: "Send Message",
      messageText: "Hi! How can we help you?",
    };
  }

  if (type === "QUICK_REPLY") {
    return {
      bodyText: "Please choose an option",
      buttons: [
        { id: "option_1", label: "Option 1" },
        { id: "option_2", label: "Option 2" },
      ],
      label: "Quick Reply",
    };
  }

  if (type === "LIST_MESSAGE") {
    return {
      bodyText: "Please choose from the list below.",
      buttonText: "View options",
      label: "List Message",
      sections: [
        {
          id: "main",
          title: "Main options",
          items: [
            {
              description: "Talk to sales",
              id: "sales",
              title: "Sales",
            },
            {
              description: "Get support",
              id: "support",
              title: "Support",
            },
          ],
        },
      ],
    };
  }

  if (type === "CONDITION") {
    return {
      label: "Condition",
      operator: "EQUALS",
      value: "option_1",
      variable: "last_reply",
    };
  }

  if (type === "SEND_TEMPLATE") {
    return {
      bodyVariableMappings: [],
      buttonVariableMappings: [],
      fallbackMessage: "",
      headerType: "NONE",
      headerVariableMappings: [],
      label: "Send Template",
      languageCode: "en_US",
      templateId: "",
      templateName: "",
      templateStatus: "",
    };
  }

  if (type === "WAIT_FOR_REPLY") {
    return {
      acceptedReplyType: "ANY",
      label: "Wait for Reply",
      saveReplyAs: "last_reply",
      timeoutMinutes: 1440,
      timeoutMessage: "We did not receive a reply in time.",
    };
  }

  if (type === "BUTTON_REPLY_ROUTER") {
    return {
      fallbackEnabled: true,
      label: "Button Reply Router",
      routes: [],
      sourceNodeId: "",
    };
  }

  if (type === "API_CALL") {
    return {
      body: "{}",
      headers: [],
      label: "API Call",
      method: "POST",
      responseMapping: [],
      url: "https://example.com/webhook",
    };
  }

  if (type === "HUMAN_HANDOFF") {
    return {
      assignmentMode: "ROUND_ROBIN",
      inboxPriority: "MEDIUM",
      label: "Human Handoff",
      messageToCustomer: "Our team will join this conversation shortly.",
    };
  }

  if (type === "ADD_TAG") {
    return {
      label: "Add Tag",
      tagName: "lead",
    };
  }

  if (type === "REMOVE_TAG") {
    return {
      label: "Remove Tag",
      tagName: "lead",
    };
  }

  if (type === "UPDATE_CONTACT_FIELD") {
    return {
      fieldName: "lead_stage",
      fieldValue: "new",
      label: "Update Contact Field",
    };
  }

  if (type === "DELAY") {
    return {
      duration: 5,
      label: "Delay",
      unit: "MINUTES",
    };
  }

  if (type === "WEBHOOK") {
    return {
      authMode: "NONE",
      body: "{}",
      headers: [],
      label: "Webhook",
      method: "POST",
      mockResponse: {
        ok: true,
      },
      responseMapping: [],
      retryCount: 0,
      timeoutMs: 10000,
      url: "https://example.com/webhook",
    };
  }

  if (type === "GOOGLE_SHEET_APPEND_ROW") {
    return {
      columnMappings: [
        {
          columnName: "Phone",
          sourceType: "CONTACT_FIELD",
          sourceValue: "phoneNumber",
        },
      ],
      connectedGoogleAccountId: "",
      label: "Google Sheet Append Row",
      sheetName: "Sheet1",
      spreadsheetId: "",
    };
  }

  if (type === "GOOGLE_SHEET_UPDATE_ROW") {
    return {
      connectedGoogleAccountId: "",
      label: "Google Sheet Update Row",
      lookupColumn: "Phone",
      lookupValueSource: {
        sourceType: "CONTACT_FIELD",
        sourceValue: "phoneNumber",
      },
      sheetName: "Sheet1",
      spreadsheetId: "",
      updateMappings: [
        {
          columnName: "Status",
          sourceType: "STATIC",
          sourceValue: "Updated",
        },
      ],
    };
  }

  if (type === "TALLY_LOOKUP") {
    return {
      customerIdentifierSource: {
        sourceType: "CONTACT_FIELD",
        sourceValue: "phoneNumber",
      },
      label: "Tally Lookup",
      lookupType: "LEDGER_BALANCE",
      mockResult: {
        balance: "12500.00",
        currency: "INR",
        found: true,
      },
      saveResultAs: "tallyResult",
    };
  }

  if (type === "PAYMENT_LINK") {
    return {
      amountSource: {
        sourceType: "STATIC",
        sourceValue: "1000",
      },
      currency: "INR",
      customerNameSource: {
        sourceType: "CONTACT_FIELD",
        sourceValue: "name",
      },
      customerPhoneSource: {
        sourceType: "CONTACT_FIELD",
        sourceValue: "phoneNumber",
      },
      expiryMinutes: 1440,
      label: "Payment Link",
      mockPaymentLink: "https://payments.test/tallykonnect/mock-payment-link",
      provider: "CASHFREE",
      purpose: "Payment request",
      savePaymentLinkAs: "paymentLink",
    };
  }

  if (type === "CATALOG_SEND") {
    return {
      catalogSource: "MANUAL_PRODUCTS",
      fallbackText: "Here are the products we discussed.",
      label: "Catalog Send",
      maxProducts: 5,
      productIds: ["product_1"],
    };
  }

  if (type === "AI_REPLY") {
    return {
      confidenceThreshold: 0.7,
      fallbackMessage: "I am not fully sure. Our team will help you shortly.",
      knowledgeBaseIds: [],
      label: "AI Reply",
      maxTokens: 300,
      saveReplyAs: "aiReply",
      systemInstruction: "Answer briefly and avoid unsupported claims.",
      userMessageSource: {
        sourceType: "TRIGGER_MESSAGE",
        sourceValue: "trigger.text",
      },
    };
  }

  if (type === "FALLBACK") {
    return {
      fallbackMessage: "Sorry, I could not process that. Let me route you safely.",
      label: "Fallback",
      nextAction: "SEND_MESSAGE",
    };
  }

  if (type === "RETRY") {
    return {
      label: "Retry",
      maxRetries: 3,
      onMaxRetriesAction: "ERROR_PATH",
      retryDelaySeconds: 5,
      retryTargetNodeId: "",
    };
  }

  if (type === "ERROR_HANDLER") {
    return {
      endSession: false,
      errorMessageToCustomer: "Something went wrong. Our team will check this.",
      label: "Error Handler",
      notifyTeam: true,
      openInbox: true,
    };
  }

  return {
    endReason: "Completed",
    label: "End",
  };
}

export function normalizeAutomationNodeData(
  type: AutomationNodeType,
  input: unknown,
): AutomationNodeData {
  const data = isRecord(input) ? input : {};
  const defaults = createDefaultNodeData(type);
  const label = readString(data.label, defaults.label).trim();

  if (type === "START") {
    return {
      keywords: readStringArray(data.keywords, ["hi", "hello"]),
      label,
      triggerType: [
        "KEYWORD",
        "DEFAULT",
        "TEMPLATE_REPLY",
        "BUTTON_REPLY",
        "WEBHOOK",
        "MANUAL",
      ].includes(readString(data.triggerType))
        ? (data.triggerType as Extract<
            AutomationNodeData,
            { triggerType: unknown }
          >["triggerType"])
        : "KEYWORD",
    };
  }

  if (type === "TEMPLATE_TRIGGER") {
    const triggerMode = readString(data.triggerMode, "ANY_TEMPLATE_REPLY").toUpperCase();

    return {
      buttonIds: readStringArray(data.buttonIds, []),
      campaignId: readString(data.campaignId) || undefined,
      keywords: readStringArray(data.keywords, []),
      label,
      templateId: readString(data.templateId) || undefined,
      triggerMode: [
        "ANY_TEMPLATE_REPLY",
        "SPECIFIC_TEMPLATE_REPLY",
        "SPECIFIC_CAMPAIGN_REPLY",
        "BUTTON_REPLY",
        "TEXT_REPLY",
      ].includes(triggerMode)
        ? (triggerMode as Extract<
            AutomationNodeData,
            { triggerMode: unknown }
          >["triggerMode"])
        : "ANY_TEMPLATE_REPLY",
      triggerName: readString(
        data.triggerName,
        "Template reply received",
      ),
    };
  }

  if (type === "SEND_MESSAGE") {
    return {
      label,
      mediaUrl: readString(data.mediaUrl) || undefined,
      messageText: readString(data.messageText, readString(data.body)),
    };
  }

  if (type === "QUICK_REPLY") {
    return {
      bodyText: readString(data.bodyText, readString(data.body)),
      buttons: normalizeButtons(data.buttons),
      label,
    };
  }

  if (type === "LIST_MESSAGE") {
    return {
      bodyText: readString(data.bodyText, readString(data.body)),
      buttonText: readString(data.buttonText, readString(data.primaryButton, "View options")),
      label,
      sections: normalizeSections(data.sections),
    };
  }

  if (type === "CONDITION") {
    return {
      label,
      operator: normalizeConditionOperator(data.operator),
      value:
        readScalar(data.value) ??
        readScalar(data.conditionValue) ??
        readString(data.conditionValue),
      variable: readString(data.variable, readString(data.field, "last_reply")),
    };
  }

  if (type === "SEND_TEMPLATE") {
    const legacyMappings = normalizeTemplateMappings(
      data.variableMappings,
      "BODY",
    );
    const bodyVariableMappings = normalizeTemplateMappings(
      data.bodyVariableMappings,
      "BODY",
    );

    return {
      bodyVariableMappings:
        bodyVariableMappings.length > 0 ? bodyVariableMappings : legacyMappings,
      buttonVariableMappings: normalizeTemplateMappings(
        data.buttonVariableMappings,
        "BUTTON",
      ),
      category: readString(data.category) || undefined,
      fallbackMessage: readString(data.fallbackMessage) || undefined,
      headerType: normalizeHeaderType(data.headerType),
      headerVariableMappings: normalizeTemplateMappings(
        data.headerVariableMappings,
        "HEADER",
      ),
      label,
      languageCode: readString(data.languageCode, "en_US"),
      mediaUrl: readString(data.mediaUrl) || undefined,
      templateId: readString(data.templateId),
      templateName: readString(data.templateName) || undefined,
      templateStatus: readString(data.templateStatus) || undefined,
    };
  }

  if (type === "WAIT_FOR_REPLY") {
    return {
      acceptedReplyType: ["TEXT", "BUTTON", "LIST", "ANY"].includes(
        readString(data.acceptedReplyType),
      )
        ? (data.acceptedReplyType as Extract<
            AutomationNodeData,
            { acceptedReplyType: unknown }
          >["acceptedReplyType"])
        : "ANY",
      label,
      saveReplyAs: readString(data.saveReplyAs, "last_reply"),
      timeoutMessage: readString(data.timeoutMessage) || undefined,
      timeoutMinutes: readNumber(data.timeoutMinutes, 1440),
    };
  }

  if (type === "BUTTON_REPLY_ROUTER") {
    return {
      fallbackEnabled:
        typeof data.fallbackEnabled === "boolean" ? data.fallbackEnabled : true,
      label,
      routes: normalizeButtonReplyRoutes(data.routes),
      sourceNodeId: readString(data.sourceNodeId),
    };
  }

  if (type === "API_CALL") {
    return {
      body: readString(data.body) || undefined,
      headers: normalizeHeaders(data.headers),
      label,
      method: ["GET", "POST", "PUT", "PATCH", "DELETE"].includes(
        readString(data.method),
      )
        ? (data.method as Extract<
            AutomationNodeData,
            { method: unknown }
          >["method"])
        : "POST",
      responseMapping: normalizeResponseMappings(data.responseMapping),
      url: readString(data.url, readString(data.apiUrl)),
    };
  }

  if (type === "HUMAN_HANDOFF") {
    const priority = readString(data.inboxPriority, "MEDIUM").toUpperCase();
    const assignmentMode = readString(data.assignmentMode, "ROUND_ROBIN").toUpperCase();

    return {
      assignedUserId: readString(data.assignedUserId) || undefined,
      assignmentMode: ["UNASSIGNED", "ROUND_ROBIN", "SPECIFIC_USER"].includes(
        assignmentMode,
      )
        ? (assignmentMode as Extract<
            AutomationNodeData,
            { assignmentMode: unknown }
          >["assignmentMode"])
        : "ROUND_ROBIN",
      inboxPriority: ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority)
        ? (priority as Extract<
            AutomationNodeData,
            { inboxPriority: unknown }
          >["inboxPriority"])
        : "MEDIUM",
      label,
      messageToCustomer: readString(data.messageToCustomer),
    };
  }

  if (type === "ADD_TAG") {
    return {
      label,
      tagName: readString(data.tagName),
    };
  }

  if (type === "REMOVE_TAG") {
    return {
      label,
      tagName: readString(data.tagName),
    };
  }

  if (type === "UPDATE_CONTACT_FIELD") {
    return {
      fieldName: readString(data.fieldName),
      fieldValue: readString(data.fieldValue),
      label,
    };
  }

  if (type === "DELAY") {
    return {
      duration: readNumber(data.duration, 5),
      label,
      unit: ["SECONDS", "MINUTES", "HOURS", "DAYS"].includes(
        readString(data.unit),
      )
        ? (data.unit as Extract<AutomationNodeData, { unit: unknown }>["unit"])
        : "MINUTES",
    };
  }

  if (type === "WEBHOOK") {
    const authMode = readString(data.authMode, "NONE").toUpperCase();
    const authConfig = isRecord(data.authConfig) ? data.authConfig : {};

    return {
      authConfig: {
        headerName: readString(authConfig.headerName) || undefined,
        passwordSecretId: readString(authConfig.passwordSecretId) || undefined,
        tokenSecretId: readString(authConfig.tokenSecretId) || undefined,
        usernameSecretId: readString(authConfig.usernameSecretId) || undefined,
      },
      authMode: ["NONE", "API_KEY", "BEARER_TOKEN", "BASIC"].includes(authMode)
        ? (authMode as "NONE" | "API_KEY" | "BEARER_TOKEN" | "BASIC")
        : "NONE",
      body: readString(data.body) || undefined,
      headers: normalizeHeaders(data.headers),
      label,
      method: ["GET", "POST", "PUT", "PATCH", "DELETE"].includes(
        readString(data.method),
      )
        ? (data.method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE")
        : "POST",
      mockResponse: parseJsonValue(data.mockResponse),
      responseMapping: normalizeResponseMappings(data.responseMapping),
      retryCount: Math.max(0, Math.min(3, readNumber(data.retryCount, 0))),
      timeoutMs: Math.max(1000, Math.min(30000, readNumber(data.timeoutMs, 10000))),
      url: readString(data.url),
    };
  }

  if (type === "GOOGLE_SHEET_APPEND_ROW") {
    return {
      columnMappings: normalizeColumnMappings(data.columnMappings),
      connectedGoogleAccountId: readString(data.connectedGoogleAccountId),
      label,
      sheetName: readString(data.sheetName, "Sheet1"),
      spreadsheetId: readString(data.spreadsheetId),
    };
  }

  if (type === "GOOGLE_SHEET_UPDATE_ROW") {
    return {
      connectedGoogleAccountId: readString(data.connectedGoogleAccountId),
      label,
      lookupColumn: readString(data.lookupColumn),
      lookupValueSource: normalizeValueSource(data.lookupValueSource, {
        sourceType: "CONTACT_FIELD",
        sourceValue: "phoneNumber",
      }),
      sheetName: readString(data.sheetName, "Sheet1"),
      spreadsheetId: readString(data.spreadsheetId),
      updateMappings: normalizeColumnMappings(data.updateMappings),
    };
  }

  if (type === "TALLY_LOOKUP") {
    const lookupType = readString(data.lookupType, "LEDGER_BALANCE").toUpperCase();

    return {
      customerIdentifierSource: normalizeValueSource(
        data.customerIdentifierSource,
        {
          sourceType: "CONTACT_FIELD",
          sourceValue: "phoneNumber",
        },
      ),
      invoiceNumberSource: data.invoiceNumberSource
        ? normalizeValueSource(data.invoiceNumberSource)
        : undefined,
      label,
      lookupType: [
        "LEDGER_BALANCE",
        "INVOICE_STATUS",
        "STOCK_ITEM",
        "CUSTOMER_DUES",
        "CUSTOMER_LEDGER",
        "SALES_ORDER_STATUS",
      ].includes(lookupType)
        ? (lookupType as Extract<
            AutomationNodeData,
            { lookupType: unknown }
          >["lookupType"])
        : "LEDGER_BALANCE",
      mockResult: parseJsonValue(data.mockResult),
      saveResultAs: readString(data.saveResultAs, "tallyResult"),
      stockItemSource: data.stockItemSource
        ? normalizeValueSource(data.stockItemSource)
        : undefined,
    };
  }

  if (type === "PAYMENT_LINK") {
    return {
      amountSource: normalizeValueSource(data.amountSource, {
        sourceType: "STATIC",
        sourceValue: "1000",
      }),
      currency: "INR",
      customerEmailSource: data.customerEmailSource
        ? normalizeValueSource(data.customerEmailSource)
        : undefined,
      customerNameSource: normalizeValueSource(data.customerNameSource, {
        sourceType: "CONTACT_FIELD",
        sourceValue: "name",
      }),
      customerPhoneSource: normalizeValueSource(data.customerPhoneSource, {
        sourceType: "CONTACT_FIELD",
        sourceValue: "phoneNumber",
      }),
      expiryMinutes: Math.max(
        10,
        Math.min(10080, readNumber(data.expiryMinutes, 1440)),
      ),
      label,
      mockPaymentLink: readString(data.mockPaymentLink) || undefined,
      provider: "CASHFREE",
      purpose: readString(data.purpose, "Payment request"),
      savePaymentLinkAs: readString(data.savePaymentLinkAs, "paymentLink"),
    };
  }

  if (type === "CATALOG_SEND") {
    const catalogSource = readString(data.catalogSource, "MANUAL_PRODUCTS").toUpperCase();

    return {
      catalogId: readString(data.catalogId) || undefined,
      catalogSource: [
        "WHATSAPP_CATALOG",
        "TALLY_STOCK",
        "MANUAL_PRODUCTS",
      ].includes(catalogSource)
        ? (catalogSource as "WHATSAPP_CATALOG" | "TALLY_STOCK" | "MANUAL_PRODUCTS")
        : "MANUAL_PRODUCTS",
      categoryFilter: readString(data.categoryFilter) || undefined,
      fallbackText: readString(data.fallbackText) || undefined,
      label,
      maxProducts: Math.max(1, Math.min(30, readNumber(data.maxProducts, 5))),
      productIds: readStringArray(data.productIds, []),
    };
  }

  if (type === "AI_REPLY") {
    const mockResponse = parseJsonValue(data.mockResponse);

    return {
      agentId: readString(data.agentId) || undefined,
      confidenceThreshold: Math.max(
        0,
        Math.min(1, readNumber(data.confidenceThreshold, 0.7)),
      ),
      fallbackMessage: readString(data.fallbackMessage),
      knowledgeBaseIds: readStringArray(data.knowledgeBaseIds, []),
      label,
      maxTokens: Math.max(50, Math.min(1000, readNumber(data.maxTokens, 300))),
      mockResponse: isRecord(mockResponse)
        ? {
            confidence: readNumber(mockResponse.confidence, 0.8),
            text: readString(mockResponse.text),
          }
        : undefined,
      saveReplyAs: readString(data.saveReplyAs, "aiReply"),
      systemInstruction: readString(data.systemInstruction),
      userMessageSource: normalizeAiMessageSource(data.userMessageSource),
    };
  }

  if (type === "FALLBACK") {
    const nextAction = readString(data.nextAction, "SEND_MESSAGE").toUpperCase();

    return {
      fallbackMessage: readString(data.fallbackMessage),
      label,
      nextAction: ["SEND_MESSAGE", "HUMAN_HANDOFF", "END"].includes(nextAction)
        ? (nextAction as "SEND_MESSAGE" | "HUMAN_HANDOFF" | "END")
        : "SEND_MESSAGE",
    };
  }

  if (type === "RETRY") {
    const action = readString(data.onMaxRetriesAction, "ERROR_PATH").toUpperCase();

    return {
      label,
      maxRetries: Math.max(1, Math.min(5, readNumber(data.maxRetries, 3))),
      onMaxRetriesAction: [
        "ERROR_PATH",
        "HUMAN_HANDOFF",
        "END",
      ].includes(action)
        ? (action as "ERROR_PATH" | "HUMAN_HANDOFF" | "END")
        : "ERROR_PATH",
      retryDelaySeconds: Math.max(
        1,
        Math.min(3600, readNumber(data.retryDelaySeconds, 5)),
      ),
      retryTargetNodeId: readString(data.retryTargetNodeId),
    };
  }

  if (type === "ERROR_HANDLER") {
    return {
      endSession: readBoolean(data.endSession, false),
      errorMessageToCustomer: readString(data.errorMessageToCustomer) || undefined,
      label,
      notifyTeam: readBoolean(data.notifyTeam, true),
      openInbox: readBoolean(data.openInbox, true),
    };
  }

  return {
    endReason: readString(data.endReason) || undefined,
    label,
  };
}

export function normalizeAutomationGraph(input: unknown): AutomationGraph {
  const graph = isRecord(input) ? input : {};
  const rawNodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const rawEdges = Array.isArray(graph.edges) ? graph.edges : [];

  const nodes: AutomationNode[] = rawNodes.map((rawNode, index) => {
    const node = isRecord(rawNode) ? rawNode : {};
    const rawType = node.type ?? node.nodeType;
    const type = isAutomationNodeType(rawType) ? rawType : "SEND_MESSAGE";
    const position = isRecord(node.position) ? node.position : {};

    return {
      data: normalizeAutomationNodeData(type, node.data),
      id: readString(node.id, `node_${index + 1}`),
      position: {
        x: readNumber(position.x, 140 + index * 300),
        y: readNumber(position.y, 160),
      },
      type,
    };
  });

  const edges: AutomationEdge[] = rawEdges.map((rawEdge, index) => {
    const edge = isRecord(rawEdge) ? rawEdge : {};

    return {
      id: readString(edge.id, `edge_${index + 1}`),
      label: readString(edge.label) || undefined,
      source: readString(edge.source, readString(edge.sourceNodeId)),
      sourceHandle: readString(edge.sourceHandle) || undefined,
      target: readString(edge.target, readString(edge.targetNodeId)),
      targetHandle: readString(edge.targetHandle) || undefined,
    };
  });

  return {
    edges,
    nodes,
    version: 1,
  };
}

export function createDefaultAutomationGraph(): AutomationGraph {
  return {
    edges: [
      {
        id: "edge_start_welcome",
        source: "node_start",
        target: "node_welcome",
      },
      {
        id: "edge_welcome_options",
        source: "node_welcome",
        target: "node_options",
      },
      {
        id: "edge_options_handoff",
        label: "Option 1",
        source: "node_options",
        sourceHandle: "button:option_1",
        target: "node_handoff",
      },
      {
        id: "edge_handoff_end",
        source: "node_handoff",
        target: "node_end",
      },
    ],
    nodes: [
      {
        data: createDefaultNodeData("START"),
        id: "node_start",
        position: { x: 80, y: 220 },
        type: "START",
      },
      {
        data: createDefaultNodeData("SEND_MESSAGE"),
        id: "node_welcome",
        position: { x: 390, y: 160 },
        type: "SEND_MESSAGE",
      },
      {
        data: createDefaultNodeData("QUICK_REPLY"),
        id: "node_options",
        position: { x: 710, y: 160 },
        type: "QUICK_REPLY",
      },
      {
        data: createDefaultNodeData("HUMAN_HANDOFF"),
        id: "node_handoff",
        position: { x: 1030, y: 160 },
        type: "HUMAN_HANDOFF",
      },
      {
        data: createDefaultNodeData("END"),
        id: "node_end",
        position: { x: 1350, y: 220 },
        type: "END",
      },
    ],
    version: 1,
  };
}
