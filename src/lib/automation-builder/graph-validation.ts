import { normalizeAutomationGraph } from "@/lib/automation-builder/node-defaults";
import {
  getNodeInputHandles,
  getNodeOutputHandles,
  resolveSourceHandleId,
  resolveTargetHandleId,
} from "@/lib/automation-builder/connection-handles";
import {
  automationNodeTypes,
  isAutomationNodeType,
  type AutomationEdge,
  type AutomationGraph,
  type AutomationGraphValidationIssue,
  type AutomationGraphValidationResult,
  type AutomationNode,
} from "@/lib/automation-builder/types";
import {
  getAutomationNodeFeatureFlag,
  isAdvancedAutomationNode,
  isAutomationNodeTypeEnabled,
} from "@/lib/automation-builder/feature-flags";

export { normalizeAutomationGraph };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isBlank(value: unknown) {
  return typeof value !== "string" || value.trim().length === 0;
}

function isHttpUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return false;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isPrivateOrLocalUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return false;

  try {
    const hostname = new URL(value).hostname.toLowerCase();
    const parts = hostname.split(".").map((part) => Number(part));

    if (
      hostname === "localhost" ||
      hostname === "::1" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".localhost")
    ) {
      return true;
    }

    if (parts.length === 4 && parts.every((part) => Number.isInteger(part))) {
      const [first, second] = parts;
      return (
        first === 10 ||
        first === 127 ||
        first === 0 ||
        (first === 169 && second === 254) ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168)
      );
    }
  } catch {
    return false;
  }

  return false;
}

function isAllowedValueSourceType(value: unknown) {
  return [
    "CONTACT_FIELD",
    "STATIC",
    "SESSION_CONTEXT",
    "PREVIOUS_NODE_OUTPUT",
    "CUSTOM_ATTRIBUTE",
  ].includes(stringValue(value));
}

function isAllowedAiMessageSourceType(value: unknown) {
  return [
    "TRIGGER_MESSAGE",
    "SESSION_CONTEXT",
    "PREVIOUS_NODE_OUTPUT",
    "STATIC",
  ].includes(stringValue(value));
}

function validateValueSource({
  errors,
  fieldLabel,
  nodeId,
  required = true,
  value,
}: {
  errors: AutomationGraphValidationIssue[];
  fieldLabel: string;
  nodeId: string;
  required?: boolean;
  value: unknown;
}) {
  if (!isRecord(value)) {
    if (required) {
      errors.push(
        issue(
          "ERROR",
          "VALUE_SOURCE_REQUIRED",
          `${fieldLabel} requires a value source.`,
          { nodeId },
        ),
      );
    }
    return;
  }

  if (!isAllowedValueSourceType(value.sourceType)) {
    errors.push(
      issue(
        "ERROR",
        "VALUE_SOURCE_TYPE_INVALID",
        `${fieldLabel} has an invalid source type.`,
        { nodeId },
      ),
    );
  }

  if (isBlank(value.sourceValue)) {
    errors.push(
      issue(
        "ERROR",
        "VALUE_SOURCE_VALUE_REQUIRED",
        `${fieldLabel} requires a source value.`,
        { nodeId },
      ),
    );
  }
}

function validateColumnMappings({
  errors,
  fieldLabel,
  nodeId,
  value,
}: {
  errors: AutomationGraphValidationIssue[];
  fieldLabel: string;
  nodeId: string;
  value: unknown;
}) {
  const mappings = Array.isArray(value) ? value : [];

  if (mappings.length === 0) {
    errors.push(
      issue(
        "ERROR",
        "COLUMN_MAPPING_REQUIRED",
        `${fieldLabel} requires at least one column mapping.`,
        { nodeId },
      ),
    );
    return;
  }

  const columnNames: string[] = [];

  mappings.forEach((mapping, index) => {
    const record = isRecord(mapping) ? mapping : {};
    const columnName = stringValue(record.columnName);
    columnNames.push(columnName);

    if (!columnName.trim()) {
      errors.push(
        issue(
          "ERROR",
          "COLUMN_MAPPING_NAME_REQUIRED",
          `${fieldLabel} mapping ${index + 1} requires a column name.`,
          { nodeId },
        ),
      );
    }

    validateValueSource({
      errors,
      fieldLabel: `${fieldLabel} mapping ${index + 1}`,
      nodeId,
      value: record,
    });
  });

  if (collectDuplicateValues(columnNames).size > 0) {
    errors.push(
      issue(
        "ERROR",
        "COLUMN_MAPPING_DUPLICATE",
        `${fieldLabel} column names must be unique.`,
        { nodeId },
      ),
    );
  }
}

function validateResponseMappings(
  mappings: unknown,
  nodeId: string,
  errors: AutomationGraphValidationIssue[],
) {
  if (!Array.isArray(mappings)) {
    errors.push(
      issue(
        "ERROR",
        "RESPONSE_MAPPINGS_INVALID",
        "Response mappings must be an array.",
        { nodeId },
      ),
    );
    return;
  }

  mappings.forEach((mapping, index) => {
    const record = isRecord(mapping) ? mapping : {};

    if (isBlank(record.responsePath)) {
      errors.push(
        issue(
          "ERROR",
          "RESPONSE_MAPPING_PATH_REQUIRED",
          `Response mapping ${index + 1} requires a response path.`,
          { nodeId },
        ),
      );
    }

    if (isBlank(record.saveAs)) {
      errors.push(
        issue(
          "ERROR",
          "RESPONSE_MAPPING_SAVE_AS_REQUIRED",
          `Response mapping ${index + 1} requires a save variable.`,
          { nodeId },
        ),
      );
    }
  });
}

function validateNumberRange({
  errors,
  label,
  max,
  min,
  nodeId,
  value,
}: {
  errors: AutomationGraphValidationIssue[];
  label: string;
  max: number;
  min: number;
  nodeId: string;
  value: unknown;
}) {
  const number = numberValue(value);

  if (number === null || number < min || number > max) {
    errors.push(
      issue(
        "ERROR",
        "NUMBER_RANGE_INVALID",
        `${label} must be between ${min} and ${max}.`,
        { nodeId },
      ),
    );
  }
}

function issue(
  severity: AutomationGraphValidationIssue["severity"],
  code: string,
  message: string,
  context: Pick<AutomationGraphValidationIssue, "edgeId" | "nodeId"> = {},
): AutomationGraphValidationIssue {
  return {
    code,
    message,
    severity,
    ...context,
  };
}

function dataRecord(node: AutomationNode): Record<string, unknown> {
  return isRecord(node.data) ? node.data : {};
}

function getOutgoingEdges(edges: AutomationEdge[], nodeId: string) {
  return edges.filter((edge) => edge.source === nodeId);
}

function collectDuplicateValues(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }

  return duplicates;
}

function validateTemplateMappings(
  mappings: unknown,
  component: "HEADER" | "BODY" | "BUTTON",
  nodeId: string,
  errors: AutomationGraphValidationIssue[],
) {
  if (!Array.isArray(mappings)) {
    errors.push(
      issue(
        "ERROR",
        "SEND_TEMPLATE_VARIABLE_MAPPINGS_INVALID",
        `${component} variable mappings must be an array.`,
        { nodeId },
      ),
    );
    return;
  }

  mappings.forEach((mapping, index) => {
    const record = isRecord(mapping) ? mapping : {};
    const sourceType = stringValue(record.sourceType);
    const sourceValue = stringValue(record.sourceValue);
    const variableName = stringValue(record.variableName);

    if (!variableName.trim()) {
      errors.push(
        issue(
          "ERROR",
          "SEND_TEMPLATE_VARIABLE_NAME_REQUIRED",
          `${component} mapping ${index + 1} requires a variable name.`,
          { nodeId },
        ),
      );
    }

    if (
      ![
        "CONTACT_FIELD",
        "STATIC",
        "SESSION_CONTEXT",
        "PREVIOUS_NODE_OUTPUT",
        "CUSTOM_ATTRIBUTE",
      ].includes(sourceType)
    ) {
      errors.push(
        issue(
          "ERROR",
          "SEND_TEMPLATE_VARIABLE_SOURCE_INVALID",
          `${component} mapping ${index + 1} has an invalid source type.`,
          { nodeId },
        ),
      );
    }

    if (!sourceValue.trim()) {
      errors.push(
        issue(
          "ERROR",
          "SEND_TEMPLATE_VARIABLE_SOURCE_REQUIRED",
          `${component} variable "${variableName || index + 1}" requires a source value.`,
          { nodeId },
        ),
      );
    }
  });
}

function validateNodeFields(
  node: AutomationNode,
  errors: AutomationGraphValidationIssue[],
) {
  const data = dataRecord(node);

  if (isBlank(node.id)) {
    errors.push(
      issue("ERROR", "NODE_ID_REQUIRED", "Every node must have an ID.", {
        nodeId: node.id,
      }),
    );
  }

  if (!isAutomationNodeType(node.type)) {
    errors.push(
      issue(
        "ERROR",
        "UNKNOWN_NODE_TYPE",
        `Node type "${String(node.type)}" is not supported.`,
        { nodeId: node.id },
      ),
    );
    return;
  }

  if (
    isAdvancedAutomationNode(node.type) &&
    !isAutomationNodeTypeEnabled(node.type)
  ) {
    const flag = getAutomationNodeFeatureFlag(node.type);
    errors.push(
      issue(
        "ERROR",
        "AUTOMATION_NODE_FEATURE_DISABLED",
        flag
          ? `${node.type} is disabled. Enable ${flag} before publishing this node.`
          : `${node.type} is disabled and cannot be published.`,
        { nodeId: node.id },
      ),
    );
  }

  if (!isRecord(node.position)) {
    errors.push(
      issue("ERROR", "NODE_POSITION_REQUIRED", "Node position is required.", {
        nodeId: node.id,
      }),
    );
  } else {
    if (numberValue(node.position.x) === null) {
      errors.push(
        issue(
          "ERROR",
          "NODE_POSITION_X_INVALID",
          "Node position x must be a number.",
          { nodeId: node.id },
        ),
      );
    }

    if (numberValue(node.position.y) === null) {
      errors.push(
        issue(
          "ERROR",
          "NODE_POSITION_Y_INVALID",
          "Node position y must be a number.",
          { nodeId: node.id },
        ),
      );
    }
  }

  if (!isRecord(node.data)) {
    errors.push(
      issue("ERROR", "NODE_DATA_REQUIRED", "Node data object is required.", {
        nodeId: node.id,
      }),
    );
    return;
  }

  if (isBlank(data.label)) {
    errors.push(
      issue("ERROR", "NODE_LABEL_REQUIRED", "Node label is required.", {
        nodeId: node.id,
      }),
    );
  }

  if (node.type === "START") {
    if (isBlank(data.triggerType)) {
      errors.push(
        issue("ERROR", "START_TRIGGER_REQUIRED", "Start trigger type is required.", {
          nodeId: node.id,
        }),
      );
    }

    if (data.triggerType === "KEYWORD") {
      const keywords = Array.isArray(data.keywords)
        ? data.keywords.filter(
            (keyword: unknown): keyword is string =>
              typeof keyword === "string",
          )
        : [];

      if (!keywords.some((keyword) => keyword.trim())) {
        errors.push(
          issue(
            "ERROR",
            "START_KEYWORDS_REQUIRED",
            "Keyword trigger must contain at least one keyword.",
            { nodeId: node.id },
          ),
        );
      }

      if (collectDuplicateValues(keywords).size > 0) {
        errors.push(
          issue(
            "ERROR",
            "START_KEYWORDS_DUPLICATE",
            "Start keywords must be unique.",
            { nodeId: node.id },
          ),
        );
      }
    }
  }

  if (node.type === "TEMPLATE_TRIGGER") {
    const triggerMode = stringValue(data.triggerMode);

    if (isBlank(data.triggerName)) {
      errors.push(
        issue(
          "ERROR",
          "TEMPLATE_TRIGGER_NAME_REQUIRED",
          "Template Trigger requires a name.",
          { nodeId: node.id },
        ),
      );
    }

    if (
      ![
        "ANY_TEMPLATE_REPLY",
        "SPECIFIC_TEMPLATE_REPLY",
        "SPECIFIC_CAMPAIGN_REPLY",
        "BUTTON_REPLY",
        "TEXT_REPLY",
      ].includes(triggerMode)
    ) {
      errors.push(
        issue(
          "ERROR",
          "TEMPLATE_TRIGGER_MODE_INVALID",
          "Template Trigger mode is not supported.",
          { nodeId: node.id },
        ),
      );
    }

    if (triggerMode === "SPECIFIC_TEMPLATE_REPLY" && isBlank(data.templateId)) {
      errors.push(
        issue(
          "ERROR",
          "TEMPLATE_TRIGGER_TEMPLATE_REQUIRED",
          "Specific template reply trigger requires a template.",
          { nodeId: node.id },
        ),
      );
    }

    if (triggerMode === "SPECIFIC_CAMPAIGN_REPLY" && isBlank(data.campaignId)) {
      errors.push(
        issue(
          "ERROR",
          "TEMPLATE_TRIGGER_CAMPAIGN_REQUIRED",
          "Specific campaign reply trigger requires a campaign.",
          { nodeId: node.id },
        ),
      );
    }

    if (triggerMode === "BUTTON_REPLY") {
      const buttonIds = Array.isArray(data.buttonIds) ? data.buttonIds : [];
      if (!buttonIds.some((buttonId) => stringValue(buttonId).trim())) {
        errors.push(
          issue(
            "ERROR",
            "TEMPLATE_TRIGGER_BUTTON_REQUIRED",
            "Button reply trigger requires at least one button ID.",
            { nodeId: node.id },
          ),
        );
      }
    }
  }

  if (node.type === "SEND_MESSAGE") {
    const messageText = stringValue(data.messageText);

    if (!messageText.trim()) {
      errors.push(
        issue(
          "ERROR",
          "SEND_MESSAGE_TEXT_REQUIRED",
          "Send Message node requires message text.",
          { nodeId: node.id },
        ),
      );
    }

    if (messageText.length > 4096) {
      errors.push(
        issue(
          "ERROR",
          "SEND_MESSAGE_TEXT_TOO_LONG",
          "Send Message text cannot exceed 4096 characters.",
          { nodeId: node.id },
        ),
      );
    }

    if (!isBlank(data.mediaUrl) && !isHttpUrl(data.mediaUrl)) {
      errors.push(
        issue(
          "ERROR",
          "SEND_MESSAGE_MEDIA_URL_INVALID",
          "Media URL must be a valid http or https URL.",
          { nodeId: node.id },
        ),
      );
    }
  }

  if (node.type === "QUICK_REPLY") {
    if (isBlank(data.bodyText)) {
      errors.push(
        issue(
          "ERROR",
          "QUICK_REPLY_BODY_REQUIRED",
          "Quick Reply node requires body text.",
          { nodeId: node.id },
        ),
      );
    }

    const buttons = Array.isArray(data.buttons) ? data.buttons : [];

    if (buttons.length < 1 || buttons.length > 3) {
      errors.push(
        issue(
          "ERROR",
          "QUICK_REPLY_BUTTON_COUNT_INVALID",
          "Quick Reply must have 1 to 3 buttons.",
          { nodeId: node.id },
        ),
      );
    }

    const buttonIds: string[] = [];

    buttons.forEach((button: unknown, index: number) => {
      const buttonRecord = isRecord(button) ? button : {};
      const buttonId = stringValue(buttonRecord.id);
      const buttonLabel = stringValue(buttonRecord.label);

      buttonIds.push(buttonId);

      if (!buttonId.trim()) {
        errors.push(
          issue(
            "ERROR",
            "QUICK_REPLY_BUTTON_ID_REQUIRED",
            `Quick Reply button ${index + 1} requires an ID.`,
            { nodeId: node.id },
          ),
        );
      }

      if (!buttonLabel.trim()) {
        errors.push(
          issue(
            "ERROR",
            "QUICK_REPLY_BUTTON_LABEL_REQUIRED",
            `Quick Reply button ${index + 1} requires a label.`,
            { nodeId: node.id },
          ),
        );
      }

      if (buttonLabel.length > 20) {
        errors.push(
          issue(
            "ERROR",
            "QUICK_REPLY_BUTTON_LABEL_TOO_LONG",
            "Quick Reply button labels cannot exceed 20 characters.",
            { nodeId: node.id },
          ),
        );
      }
    });

    if (collectDuplicateValues(buttonIds).size > 0) {
      errors.push(
        issue(
          "ERROR",
          "QUICK_REPLY_BUTTON_IDS_DUPLICATE",
          "Quick Reply button IDs must be unique.",
          { nodeId: node.id },
        ),
      );
    }
  }

  if (node.type === "LIST_MESSAGE") {
    if (isBlank(data.bodyText)) {
      errors.push(
        issue("ERROR", "LIST_MESSAGE_BODY_REQUIRED", "List Message body text is required.", {
          nodeId: node.id,
        }),
      );
    }

    if (isBlank(data.buttonText)) {
      errors.push(
        issue(
          "ERROR",
          "LIST_MESSAGE_BUTTON_TEXT_REQUIRED",
          "List Message button text is required.",
          { nodeId: node.id },
        ),
      );
    }

    const sections = Array.isArray(data.sections) ? data.sections : [];

    if (sections.length === 0) {
      errors.push(
        issue(
          "ERROR",
          "LIST_MESSAGE_SECTION_REQUIRED",
          "List Message requires at least one section.",
          { nodeId: node.id },
        ),
      );
    }

    const itemIds: string[] = [];

    sections.forEach((section: unknown, sectionIndex: number) => {
      const sectionRecord = isRecord(section) ? section : {};

      if (isBlank(sectionRecord.title)) {
        errors.push(
          issue(
            "ERROR",
            "LIST_MESSAGE_SECTION_TITLE_REQUIRED",
            `List section ${sectionIndex + 1} requires a title.`,
            { nodeId: node.id },
          ),
        );
      }

      const items = Array.isArray(sectionRecord.items)
        ? sectionRecord.items
        : [];

      if (items.length === 0) {
        errors.push(
          issue(
            "ERROR",
            "LIST_MESSAGE_SECTION_ITEM_REQUIRED",
            `List section ${sectionIndex + 1} requires at least one item.`,
            { nodeId: node.id },
          ),
        );
      }

      items.forEach((item, itemIndex) => {
        const itemRecord = isRecord(item) ? item : {};
        const itemId = stringValue(itemRecord.id);

        itemIds.push(itemId);

        if (!itemId.trim()) {
          errors.push(
            issue(
              "ERROR",
              "LIST_MESSAGE_ITEM_ID_REQUIRED",
              `List item ${itemIndex + 1} requires an ID.`,
              { nodeId: node.id },
            ),
          );
        }

        if (isBlank(itemRecord.title)) {
          errors.push(
            issue(
              "ERROR",
              "LIST_MESSAGE_ITEM_TITLE_REQUIRED",
              `List item ${itemIndex + 1} requires a title.`,
              { nodeId: node.id },
            ),
          );
        }
      });
    });

    if (collectDuplicateValues(itemIds).size > 0) {
      errors.push(
        issue(
          "ERROR",
          "LIST_MESSAGE_ITEM_IDS_DUPLICATE",
          "List Message item IDs must be unique across the node.",
          { nodeId: node.id },
        ),
      );
    }
  }

  if (node.type === "CONDITION") {
    if (isBlank(data.variable)) {
      errors.push(
        issue("ERROR", "CONDITION_VARIABLE_REQUIRED", "Condition variable is required.", {
          nodeId: node.id,
        }),
      );
    }

    if (isBlank(data.operator)) {
      errors.push(
        issue("ERROR", "CONDITION_OPERATOR_REQUIRED", "Condition operator is required.", {
          nodeId: node.id,
        }),
      );
    }

    if (
      data.operator !== "IS_EMPTY" &&
      data.operator !== "IS_NOT_EMPTY" &&
      (data.value === undefined || data.value === null || data.value === "")
    ) {
      errors.push(
        issue("ERROR", "CONDITION_VALUE_REQUIRED", "Condition value is required.", {
          nodeId: node.id,
        }),
      );
    }
  }

  if (node.type === "SEND_TEMPLATE") {
    if (isBlank(data.templateId)) {
      errors.push(
        issue("ERROR", "SEND_TEMPLATE_ID_REQUIRED", "Template ID is required.", {
          nodeId: node.id,
        }),
      );
    }

    if (isBlank(data.languageCode)) {
      errors.push(
        issue(
          "ERROR",
          "SEND_TEMPLATE_LANGUAGE_REQUIRED",
          "Template language code is required.",
          { nodeId: node.id },
        ),
      );
    }

    if (
      !isBlank(data.templateStatus) &&
      stringValue(data.templateStatus) !== "APPROVED"
    ) {
      errors.push(
        issue(
          "ERROR",
          "SEND_TEMPLATE_STATUS_NOT_APPROVED",
          "Only approved WhatsApp templates can be used in automation.",
          { nodeId: node.id },
        ),
      );
    }

    const headerType = stringValue(data.headerType || "NONE");
    if (
      !["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"].includes(headerType)
    ) {
      errors.push(
        issue(
          "ERROR",
          "SEND_TEMPLATE_HEADER_TYPE_INVALID",
          "Template header type is not supported.",
          { nodeId: node.id },
        ),
      );
    }

    validateTemplateMappings(
      data.headerVariableMappings,
      "HEADER",
      node.id,
      errors,
    );
    validateTemplateMappings(
      data.bodyVariableMappings,
      "BODY",
      node.id,
      errors,
    );
    validateTemplateMappings(
      data.buttonVariableMappings,
      "BUTTON",
      node.id,
      errors,
    );

    if (
      ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType) &&
      isBlank(data.mediaUrl)
    ) {
      errors.push(
        issue(
          "ERROR",
          "SEND_TEMPLATE_MEDIA_URL_REQUIRED",
          "Media URL is required for image, video, or document template headers.",
          { nodeId: node.id },
        ),
      );
    }

    if (!isBlank(data.mediaUrl) && !isHttpUrl(data.mediaUrl)) {
      errors.push(
        issue(
          "ERROR",
          "SEND_TEMPLATE_MEDIA_URL_INVALID",
          "Template media URL must be a valid http or https URL.",
          { nodeId: node.id },
        ),
      );
    }

    if (stringValue(data.fallbackMessage).length > 1024) {
      errors.push(
        issue(
          "ERROR",
          "SEND_TEMPLATE_FALLBACK_TOO_LONG",
          "Fallback message cannot exceed 1024 characters.",
          { nodeId: node.id },
        ),
      );
    }
  }

  if (node.type === "WAIT_FOR_REPLY") {
    const timeoutMinutes = numberValue(data.timeoutMinutes);

    if (timeoutMinutes === null) {
      errors.push(
        issue(
          "ERROR",
          "WAIT_FOR_REPLY_TIMEOUT_REQUIRED",
          "Wait for Reply timeout is required.",
          { nodeId: node.id },
        ),
      );
    } else if (timeoutMinutes < 1 || timeoutMinutes > 10080) {
      errors.push(
        issue(
          "ERROR",
          "WAIT_FOR_REPLY_TIMEOUT_INVALID",
          "Wait for Reply timeout must be between 1 and 10080 minutes.",
          { nodeId: node.id },
        ),
      );
    }

    if (isBlank(data.saveReplyAs)) {
      errors.push(
        issue(
          "ERROR",
          "WAIT_FOR_REPLY_SAVE_AS_REQUIRED",
          "Wait for Reply requires a save variable.",
          { nodeId: node.id },
        ),
      );
    }

    if (isBlank(data.acceptedReplyType)) {
      errors.push(
        issue(
          "ERROR",
          "WAIT_FOR_REPLY_ACCEPTED_TYPE_REQUIRED",
          "Wait for Reply accepted reply type is required.",
          { nodeId: node.id },
        ),
      );
    }

    if (
      !["TEXT", "BUTTON", "LIST", "ANY"].includes(
        stringValue(data.acceptedReplyType),
      )
    ) {
      errors.push(
        issue(
          "ERROR",
          "WAIT_FOR_REPLY_ACCEPTED_TYPE_INVALID",
          "Wait for Reply accepted reply type is not supported.",
          { nodeId: node.id },
        ),
      );
    }
  }

  if (node.type === "BUTTON_REPLY_ROUTER") {
    if (isBlank(data.sourceNodeId)) {
      errors.push(
        issue(
          "ERROR",
          "BUTTON_REPLY_ROUTER_SOURCE_REQUIRED",
          "Button Reply Router requires a source node.",
          { nodeId: node.id },
        ),
      );
    }

    const routes = Array.isArray(data.routes) ? data.routes : [];
    if (routes.length === 0) {
      errors.push(
        issue(
          "ERROR",
          "BUTTON_REPLY_ROUTER_ROUTE_REQUIRED",
          "Button Reply Router requires at least one route.",
          { nodeId: node.id },
        ),
      );
    }

    const routeIds: string[] = [];
    routes.forEach((route, index) => {
      const record = isRecord(route) ? route : {};
      const buttonId = stringValue(record.buttonId);
      routeIds.push(buttonId);

      if (!buttonId.trim()) {
        errors.push(
          issue(
            "ERROR",
            "BUTTON_REPLY_ROUTER_ROUTE_ID_REQUIRED",
            `Route ${index + 1} requires a button ID.`,
            { nodeId: node.id },
          ),
        );
      }

      if (isBlank(record.buttonLabel)) {
        errors.push(
          issue(
            "ERROR",
            "BUTTON_REPLY_ROUTER_ROUTE_LABEL_REQUIRED",
            `Route ${index + 1} requires a button label.`,
            { nodeId: node.id },
          ),
        );
      }
    });

    if (collectDuplicateValues(routeIds).size > 0) {
      errors.push(
        issue(
          "ERROR",
          "BUTTON_REPLY_ROUTER_ROUTE_DUPLICATE",
          "Button Reply Router routes must use unique button IDs.",
          { nodeId: node.id },
        ),
      );
    }
  }

  if (node.type === "API_CALL") {
    if (isBlank(data.method)) {
      errors.push(
        issue("ERROR", "API_CALL_METHOD_REQUIRED", "API Call method is required.", {
          nodeId: node.id,
        }),
      );
    }

    if (isBlank(data.url)) {
      errors.push(
        issue("ERROR", "API_CALL_URL_REQUIRED", "API Call URL is required.", {
          nodeId: node.id,
        }),
      );
    } else if (!isHttpUrl(data.url)) {
      errors.push(
        issue(
          "ERROR",
          "API_CALL_URL_INVALID",
          "API Call URL must be a valid http or https URL.",
          { nodeId: node.id },
        ),
      );
    } else if (isPrivateOrLocalUrl(data.url)) {
      errors.push(
        issue(
          "ERROR",
          "API_CALL_URL_PRIVATE",
          "API Call URL cannot target localhost or private network addresses.",
          { nodeId: node.id },
        ),
      );
    }

    validateResponseMappings(data.responseMapping, node.id, errors);
  }

  if (node.type === "WEBHOOK") {
    if (isBlank(data.method)) {
      errors.push(
        issue("ERROR", "WEBHOOK_METHOD_REQUIRED", "Webhook method is required.", {
          nodeId: node.id,
        }),
      );
    }

    if (isBlank(data.url)) {
      errors.push(
        issue("ERROR", "WEBHOOK_URL_REQUIRED", "Webhook URL is required.", {
          nodeId: node.id,
        }),
      );
    } else if (!isHttpUrl(data.url)) {
      errors.push(
        issue(
          "ERROR",
          "WEBHOOK_URL_INVALID",
          "Webhook URL must be a valid http or https URL.",
          { nodeId: node.id },
        ),
      );
    } else if (isPrivateOrLocalUrl(data.url)) {
      errors.push(
        issue(
          "ERROR",
          "WEBHOOK_URL_PRIVATE",
          "Webhook URL cannot target localhost or private network addresses.",
          { nodeId: node.id },
        ),
      );
    }

    validateNumberRange({
      errors,
      label: "Webhook timeout",
      max: 30000,
      min: 1000,
      nodeId: node.id,
      value: data.timeoutMs,
    });
    validateNumberRange({
      errors,
      label: "Webhook retry count",
      max: 3,
      min: 0,
      nodeId: node.id,
      value: data.retryCount,
    });
    validateResponseMappings(data.responseMapping, node.id, errors);
  }

  if (node.type === "GOOGLE_SHEET_APPEND_ROW") {
    if (isBlank(data.connectedGoogleAccountId)) {
      errors.push(
        issue(
          "ERROR",
          "GOOGLE_SHEET_ACCOUNT_REQUIRED",
          "Google Sheet node requires a connected Google account.",
          { nodeId: node.id },
        ),
      );
    }
    if (isBlank(data.spreadsheetId)) {
      errors.push(
        issue(
          "ERROR",
          "GOOGLE_SHEET_SPREADSHEET_REQUIRED",
          "Google Sheet node requires a spreadsheet ID.",
          { nodeId: node.id },
        ),
      );
    }
    if (isBlank(data.sheetName)) {
      errors.push(
        issue(
          "ERROR",
          "GOOGLE_SHEET_NAME_REQUIRED",
          "Google Sheet node requires a sheet name.",
          { nodeId: node.id },
        ),
      );
    }
    validateColumnMappings({
      errors,
      fieldLabel: "Google Sheet append",
      nodeId: node.id,
      value: data.columnMappings,
    });
  }

  if (node.type === "GOOGLE_SHEET_UPDATE_ROW") {
    if (isBlank(data.connectedGoogleAccountId)) {
      errors.push(
        issue(
          "ERROR",
          "GOOGLE_SHEET_ACCOUNT_REQUIRED",
          "Google Sheet node requires a connected Google account.",
          { nodeId: node.id },
        ),
      );
    }
    if (isBlank(data.spreadsheetId)) {
      errors.push(
        issue(
          "ERROR",
          "GOOGLE_SHEET_SPREADSHEET_REQUIRED",
          "Google Sheet node requires a spreadsheet ID.",
          { nodeId: node.id },
        ),
      );
    }
    if (isBlank(data.sheetName)) {
      errors.push(
        issue(
          "ERROR",
          "GOOGLE_SHEET_NAME_REQUIRED",
          "Google Sheet node requires a sheet name.",
          { nodeId: node.id },
        ),
      );
    }
    if (isBlank(data.lookupColumn)) {
      errors.push(
        issue(
          "ERROR",
          "GOOGLE_SHEET_LOOKUP_COLUMN_REQUIRED",
          "Google Sheet update requires a lookup column.",
          { nodeId: node.id },
        ),
      );
    }
    validateValueSource({
      errors,
      fieldLabel: "Google Sheet lookup value",
      nodeId: node.id,
      value: data.lookupValueSource,
    });
    validateColumnMappings({
      errors,
      fieldLabel: "Google Sheet update",
      nodeId: node.id,
      value: data.updateMappings,
    });
  }

  if (node.type === "TALLY_LOOKUP") {
    if (isBlank(data.lookupType)) {
      errors.push(
        issue("ERROR", "TALLY_LOOKUP_TYPE_REQUIRED", "Tally lookup type is required.", {
          nodeId: node.id,
        }),
      );
    }
    validateValueSource({
      errors,
      fieldLabel: "Tally customer identifier",
      nodeId: node.id,
      value: data.customerIdentifierSource,
    });
    if (isBlank(data.saveResultAs)) {
      errors.push(
        issue(
          "ERROR",
          "TALLY_SAVE_RESULT_REQUIRED",
          "Tally lookup requires a result variable.",
          { nodeId: node.id },
        ),
      );
    }
  }

  if (node.type === "PAYMENT_LINK") {
    validateValueSource({
      errors,
      fieldLabel: "Payment amount",
      nodeId: node.id,
      value: data.amountSource,
    });
    validateValueSource({
      errors,
      fieldLabel: "Payment customer name",
      nodeId: node.id,
      value: data.customerNameSource,
    });
    validateValueSource({
      errors,
      fieldLabel: "Payment customer phone",
      nodeId: node.id,
      value: data.customerPhoneSource,
    });
    if (isBlank(data.purpose)) {
      errors.push(
        issue("ERROR", "PAYMENT_PURPOSE_REQUIRED", "Payment purpose is required.", {
          nodeId: node.id,
        }),
      );
    }
    if (isBlank(data.savePaymentLinkAs)) {
      errors.push(
        issue(
          "ERROR",
          "PAYMENT_SAVE_AS_REQUIRED",
          "Payment Link node requires a save variable.",
          { nodeId: node.id },
        ),
      );
    }
    validateNumberRange({
      errors,
      label: "Payment link expiry",
      max: 43200,
      min: 5,
      nodeId: node.id,
      value: data.expiryMinutes,
    });
  }

  if (node.type === "CATALOG_SEND") {
    validateNumberRange({
      errors,
      label: "Catalog max products",
      max: 30,
      min: 1,
      nodeId: node.id,
      value: data.maxProducts,
    });

    if (
      data.catalogSource === "MANUAL_PRODUCTS" &&
      (!Array.isArray(data.productIds) ||
        !data.productIds.some((productId) => stringValue(productId).trim()))
    ) {
      errors.push(
        issue(
          "ERROR",
          "CATALOG_PRODUCTS_REQUIRED",
          "Manual catalog send requires at least one product ID.",
          { nodeId: node.id },
        ),
      );
    }
  }

  if (node.type === "AI_REPLY") {
    if (isBlank(data.systemInstruction)) {
      errors.push(
        issue(
          "ERROR",
          "AI_SYSTEM_INSTRUCTION_REQUIRED",
          "AI Reply requires a system instruction.",
          { nodeId: node.id },
        ),
      );
    }
    if (isBlank(data.saveReplyAs)) {
      errors.push(
        issue("ERROR", "AI_SAVE_REPLY_REQUIRED", "AI Reply requires a save variable.", {
          nodeId: node.id,
        }),
      );
    }
    if (isBlank(data.fallbackMessage)) {
      errors.push(
        issue(
          "ERROR",
          "AI_FALLBACK_REQUIRED",
          "AI Reply requires a fallback message.",
          { nodeId: node.id },
        ),
      );
    }
    if (!isRecord(data.userMessageSource)) {
      errors.push(
        issue(
          "ERROR",
          "AI_MESSAGE_SOURCE_REQUIRED",
          "AI Reply requires a user message source.",
          { nodeId: node.id },
        ),
      );
    } else {
      if (!isAllowedAiMessageSourceType(data.userMessageSource.sourceType)) {
        errors.push(
          issue(
            "ERROR",
            "AI_MESSAGE_SOURCE_TYPE_INVALID",
            "AI Reply message source type is invalid.",
            { nodeId: node.id },
          ),
        );
      }
      if (isBlank(data.userMessageSource.sourceValue)) {
        errors.push(
          issue(
            "ERROR",
            "AI_MESSAGE_SOURCE_VALUE_REQUIRED",
            "AI Reply message source requires a value.",
            { nodeId: node.id },
          ),
        );
      }
    }
    validateNumberRange({
      errors,
      label: "AI confidence threshold",
      max: 1,
      min: 0,
      nodeId: node.id,
      value: data.confidenceThreshold,
    });
    validateNumberRange({
      errors,
      label: "AI max tokens",
      max: 2000,
      min: 32,
      nodeId: node.id,
      value: data.maxTokens,
    });
  }

  if (node.type === "FALLBACK") {
    if (isBlank(data.fallbackMessage)) {
      errors.push(
        issue(
          "ERROR",
          "FALLBACK_MESSAGE_REQUIRED",
          "Fallback node requires a customer message.",
          { nodeId: node.id },
        ),
      );
    }
    if (!["SEND_MESSAGE", "HUMAN_HANDOFF", "END"].includes(stringValue(data.nextAction))) {
      errors.push(
        issue(
          "ERROR",
          "FALLBACK_ACTION_INVALID",
          "Fallback next action is invalid.",
          { nodeId: node.id },
        ),
      );
    }
  }

  if (node.type === "RETRY") {
    if (isBlank(data.retryTargetNodeId)) {
      errors.push(
        issue("ERROR", "RETRY_TARGET_REQUIRED", "Retry target node is required.", {
          nodeId: node.id,
        }),
      );
    }
    validateNumberRange({
      errors,
      label: "Retry max attempts",
      max: 5,
      min: 1,
      nodeId: node.id,
      value: data.maxRetries,
    });
    validateNumberRange({
      errors,
      label: "Retry delay",
      max: 3600,
      min: 0,
      nodeId: node.id,
      value: data.retryDelaySeconds,
    });
  }

  if (node.type === "ERROR_HANDLER") {
    if (
      data.openInbox !== true &&
      data.notifyTeam !== true &&
      data.endSession !== true &&
      isBlank(data.errorMessageToCustomer)
    ) {
      errors.push(
        issue(
          "ERROR",
          "ERROR_HANDLER_ACTION_REQUIRED",
          "Error Handler must message the customer, notify/open inbox, or end the session.",
          { nodeId: node.id },
        ),
      );
    }
  }

  if (node.type === "HUMAN_HANDOFF") {
    if (isBlank(data.inboxPriority)) {
      errors.push(
        issue(
          "ERROR",
          "HUMAN_HANDOFF_PRIORITY_REQUIRED",
          "Human Handoff inbox priority is required.",
          { nodeId: node.id },
        ),
      );
    }

    if (isBlank(data.assignmentMode)) {
      errors.push(
        issue(
          "ERROR",
          "HUMAN_HANDOFF_ASSIGNMENT_REQUIRED",
          "Human Handoff assignment mode is required.",
          { nodeId: node.id },
        ),
      );
    }

    if (data.assignmentMode === "SPECIFIC_USER" && isBlank(data.assignedUserId)) {
      errors.push(
        issue(
          "ERROR",
          "HUMAN_HANDOFF_USER_REQUIRED",
          "Specific user handoff requires an assigned user.",
          { nodeId: node.id },
        ),
      );
    }

    if (isBlank(data.messageToCustomer)) {
      errors.push(
        issue(
          "ERROR",
          "HUMAN_HANDOFF_MESSAGE_REQUIRED",
          "Human Handoff message to customer is required.",
          { nodeId: node.id },
        ),
      );
    }
  }

  if (node.type === "ADD_TAG" && isBlank(data.tagName)) {
    errors.push(
      issue("ERROR", "ADD_TAG_NAME_REQUIRED", "Add Tag requires a tag name.", {
        nodeId: node.id,
      }),
    );
  }

  if (node.type === "REMOVE_TAG" && isBlank(data.tagName)) {
    errors.push(
      issue("ERROR", "REMOVE_TAG_NAME_REQUIRED", "Remove Tag requires a tag name.", {
        nodeId: node.id,
      }),
    );
  }

  if (node.type === "UPDATE_CONTACT_FIELD") {
    if (isBlank(data.fieldName)) {
      errors.push(
        issue(
          "ERROR",
          "UPDATE_CONTACT_FIELD_NAME_REQUIRED",
          "Update Contact Field requires a field name.",
          { nodeId: node.id },
        ),
      );
    }

    if (isBlank(data.fieldValue)) {
      errors.push(
        issue(
          "ERROR",
          "UPDATE_CONTACT_FIELD_VALUE_REQUIRED",
          "Update Contact Field requires a field value.",
          { nodeId: node.id },
        ),
      );
    }
  }

  if (node.type === "DELAY") {
    const duration = numberValue(data.duration);

    if (duration === null) {
      errors.push(
        issue("ERROR", "DELAY_DURATION_REQUIRED", "Delay duration is required.", {
          nodeId: node.id,
        }),
      );
    } else if (duration <= 0) {
      errors.push(
        issue(
          "ERROR",
          "DELAY_DURATION_INVALID",
          "Delay duration must be positive.",
          { nodeId: node.id },
        ),
      );
    }

    if (isBlank(data.unit)) {
      errors.push(
        issue("ERROR", "DELAY_UNIT_REQUIRED", "Delay unit is required.", {
          nodeId: node.id,
        }),
      );
    }
  }
}

function validateBranchWarnings(
  node: AutomationNode,
  outgoingEdges: AutomationEdge[],
  warnings: AutomationGraphValidationIssue[],
) {
  const data = dataRecord(node);
  const connectedHandles = new Set(
    outgoingEdges
      .map((edge) => resolveSourceHandleId(node, edge.sourceHandle))
      .filter((handle): handle is string => Boolean(handle)),
  );
  const warnMissingHandle = (handle: string, code: string, message: string) => {
    if (!connectedHandles.has(handle)) {
      warnings.push(issue("WARNING", code, message, { nodeId: node.id }));
    }
  };

  if (node.type === "CONDITION") {
    if (!connectedHandles.has("true")) {
      warnings.push(
        issue(
          "WARNING",
          "CONDITION_MISSING_TRUE_PATH",
          "Condition node should have a true path.",
          { nodeId: node.id },
        ),
      );
    }

    if (!connectedHandles.has("false")) {
      warnings.push(
        issue(
          "WARNING",
          "CONDITION_MISSING_FALSE_PATH",
          "Condition node should have a false path.",
          { nodeId: node.id },
        ),
      );
    }
  }

  if (node.type === "API_CALL") {
    warnMissingHandle(
      "success",
      "API_CALL_MISSING_SUCCESS_PATH",
      "API Call node should have a success path.",
    );
    warnMissingHandle(
      "error",
      "API_CALL_MISSING_ERROR_PATH",
      "API Call node should have an error path.",
    );
  }

  if (node.type === "WEBHOOK") {
    warnMissingHandle(
      "success",
      "WEBHOOK_MISSING_SUCCESS_PATH",
      "Webhook node should have a success path.",
    );
    warnMissingHandle(
      "error",
      "WEBHOOK_MISSING_ERROR_PATH",
      "Webhook node should have an error path.",
    );

    if (data.mockResponse === undefined) {
      warnings.push(
        issue(
          "WARNING",
          "WEBHOOK_MOCK_RESPONSE_MISSING",
          "Add a mock response so dry-run can test webhook mappings without external calls.",
          { nodeId: node.id },
        ),
      );
    }
  }

  if (node.type === "GOOGLE_SHEET_APPEND_ROW") {
    warnMissingHandle(
      "success",
      "GOOGLE_SHEET_APPEND_MISSING_SUCCESS_PATH",
      "Google Sheet Append Row should have a success path.",
    );
    warnMissingHandle(
      "error",
      "GOOGLE_SHEET_APPEND_MISSING_ERROR_PATH",
      "Google Sheet Append Row should have an error path.",
    );
  }

  if (node.type === "GOOGLE_SHEET_UPDATE_ROW") {
    warnMissingHandle(
      "success",
      "GOOGLE_SHEET_UPDATE_MISSING_SUCCESS_PATH",
      "Google Sheet Update Row should have a success path.",
    );
    warnMissingHandle(
      "not_found",
      "GOOGLE_SHEET_UPDATE_MISSING_NOT_FOUND_PATH",
      "Google Sheet Update Row should have a not-found path.",
    );
    warnMissingHandle(
      "error",
      "GOOGLE_SHEET_UPDATE_MISSING_ERROR_PATH",
      "Google Sheet Update Row should have an error path.",
    );
  }

  if (node.type === "TALLY_LOOKUP") {
    warnMissingHandle(
      "found",
      "TALLY_LOOKUP_MISSING_FOUND_PATH",
      "Tally Lookup should have a found path.",
    );
    warnMissingHandle(
      "not_found",
      "TALLY_LOOKUP_MISSING_NOT_FOUND_PATH",
      "Tally Lookup should have a not-found path.",
    );
    warnMissingHandle(
      "error",
      "TALLY_LOOKUP_MISSING_ERROR_PATH",
      "Tally Lookup should have an error path.",
    );
  }

  if (node.type === "PAYMENT_LINK") {
    warnMissingHandle(
      "created",
      "PAYMENT_LINK_MISSING_CREATED_PATH",
      "Payment Link should have a created path.",
    );
    warnMissingHandle(
      "error",
      "PAYMENT_LINK_MISSING_ERROR_PATH",
      "Payment Link should have an error path.",
    );
  }

  if (node.type === "CATALOG_SEND") {
    warnMissingHandle(
      "sent",
      "CATALOG_SEND_MISSING_SENT_PATH",
      "Catalog Send should have a sent path.",
    );
    warnMissingHandle(
      "failed",
      "CATALOG_SEND_MISSING_FAILED_PATH",
      "Catalog Send should have a failed path.",
    );
  }

  if (node.type === "AI_REPLY") {
    warnMissingHandle(
      "answered",
      "AI_REPLY_MISSING_ANSWERED_PATH",
      "AI Reply should have an answered path.",
    );
    warnMissingHandle(
      "low_confidence",
      "AI_REPLY_MISSING_LOW_CONFIDENCE_PATH",
      "AI Reply should have a low-confidence path.",
    );
    warnMissingHandle(
      "error",
      "AI_REPLY_MISSING_ERROR_PATH",
      "AI Reply should have an error path.",
    );
  }

  if (node.type === "FALLBACK") {
    warnMissingHandle(
      stringValue(data.nextAction) === "HUMAN_HANDOFF"
        ? "handoff"
        : stringValue(data.nextAction) === "END"
          ? "end"
          : "next",
      "FALLBACK_MISSING_ACTION_PATH",
      "Fallback node should connect its selected action path.",
    );
  }

  if (node.type === "RETRY") {
    warnMissingHandle(
      "retry",
      "RETRY_MISSING_RETRY_PATH",
      "Retry node should have a retry path.",
    );
    warnMissingHandle(
      "max_retries_reached",
      "RETRY_MISSING_MAX_RETRIES_PATH",
      "Retry node should have a max-retries path.",
    );
  }

  if (node.type === "ERROR_HANDLER" && data.endSession !== true) {
    warnMissingHandle(
      "handled",
      "ERROR_HANDLER_MISSING_HANDLED_PATH",
      "Error Handler should have a handled path unless it ends the session.",
    );
  }

  if (node.type === "SEND_TEMPLATE" && !connectedHandles.has("failed")) {
    warnings.push(
      issue(
        "WARNING",
        "SEND_TEMPLATE_MISSING_FAILED_PATH",
        "Send Template node should have a failed path.",
        { nodeId: node.id },
      ),
    );
  }

  if (node.type === "WAIT_FOR_REPLY") {
    if (!connectedHandles.has("received")) {
      warnings.push(
        issue(
          "WARNING",
          "WAIT_FOR_REPLY_MISSING_RECEIVED_PATH",
          "Wait for Reply node should have a received path.",
          { nodeId: node.id },
        ),
      );
    }

    if (!connectedHandles.has("timeout")) {
      warnings.push(
        issue(
          "WARNING",
          "WAIT_FOR_REPLY_MISSING_TIMEOUT_PATH",
          "Wait for Reply node should have a timeout path.",
          { nodeId: node.id },
        ),
      );
    }
  }

  if (node.type === "BUTTON_REPLY_ROUTER") {
    if (data.fallbackEnabled !== false && !connectedHandles.has("fallback")) {
      warnings.push(
        issue(
          "WARNING",
          "BUTTON_REPLY_ROUTER_FALLBACK_MISSING",
          "Button Reply Router fallback path is enabled but not connected.",
          { nodeId: node.id },
        ),
      );
    }
  }

  if (node.type === "TEMPLATE_TRIGGER") {
    const triggerMode = stringValue(data.triggerMode);
    const hasFilters =
      !isBlank(data.templateId) ||
      !isBlank(data.campaignId) ||
      (Array.isArray(data.keywords) &&
        data.keywords.some((keyword) => stringValue(keyword).trim())) ||
      (Array.isArray(data.buttonIds) &&
        data.buttonIds.some((buttonId) => stringValue(buttonId).trim()));

    if (triggerMode === "ANY_TEMPLATE_REPLY" && !hasFilters) {
      warnings.push(
        issue(
          "WARNING",
          "TEMPLATE_TRIGGER_BROAD_MATCH",
          "Template Trigger has no filters and may match too broadly.",
          { nodeId: node.id },
        ),
      );
    }
  }

  if (["QUICK_REPLY", "LIST_MESSAGE", "BUTTON_REPLY_ROUTER"].includes(node.type)) {
    getNodeOutputHandles(node)
      .filter((handle) => handle.required)
      .forEach((handle) => {
        if (!connectedHandles.has(handle.id)) {
          warnings.push(
            issue(
              "WARNING",
              "BRANCH_PATH_MISSING",
              `"${handle.label}" should have an outgoing path.`,
              { nodeId: node.id },
            ),
          );
        }
      });
  }

  if (node.type === "SEND_TEMPLATE") {
    const mappings = [
      ...(Array.isArray(data.headerVariableMappings)
        ? data.headerVariableMappings
        : []),
      ...(Array.isArray(data.bodyVariableMappings)
        ? data.bodyVariableMappings
        : []),
      ...(Array.isArray(data.buttonVariableMappings)
        ? data.buttonVariableMappings
        : []),
    ];

    mappings.forEach((mapping) => {
      if (!isRecord(mapping)) return;

      const sourceType = stringValue(mapping.sourceType);
      const fallbackValue = stringValue(mapping.fallbackValue);

      if (
        sourceType !== "STATIC" &&
        !fallbackValue.trim()
      ) {
        warnings.push(
          issue(
            "WARNING",
            "SEND_TEMPLATE_MAPPING_FALLBACK_MISSING",
            `Variable "${stringValue(mapping.variableName) || "mapping"}" uses dynamic data without a fallback value.`,
            { nodeId: node.id },
          ),
        );
      }
    });

    if (isBlank(data.fallbackMessage)) {
      warnings.push(
        issue(
          "WARNING",
          "SEND_TEMPLATE_FALLBACK_MESSAGE_MISSING",
          "Fallback message is recommended for template send failures.",
          { nodeId: node.id },
        ),
      );
    }
  }
}

export function validateAutomationGraph(
  graph: AutomationGraph,
): AutomationGraphValidationResult {
  const errors: AutomationGraphValidationIssue[] = [];
  const warnings: AutomationGraphValidationIssue[] = [];
  const input = graph as unknown as Partial<AutomationGraph>;

  if (input.version !== undefined && input.version !== 1) {
    errors.push(
      issue(
        "ERROR",
        "GRAPH_VERSION_INVALID",
        "Automation graph version must be 1.",
      ),
    );
  }

  if (!Array.isArray(input.nodes)) {
    errors.push(
      issue("ERROR", "GRAPH_NODES_REQUIRED", "Automation graph nodes must be an array."),
    );
  }

  if (!Array.isArray(input.edges)) {
    errors.push(
      issue("ERROR", "GRAPH_EDGES_REQUIRED", "Automation graph edges must be an array."),
    );
  }

  const nodes = Array.isArray(input.nodes) ? input.nodes : [];
  const edges = Array.isArray(input.edges) ? input.edges : [];
  const knownNodeTypes = new Set<string>(automationNodeTypes);
  const nodeIds = nodes.map((node) => node.id);
  const edgeIds = edges.map((edge) => edge.id);
  const duplicateNodeIds = collectDuplicateValues(nodeIds);
  const duplicateEdgeIds = collectDuplicateValues(edgeIds);
  const nodeIdSet = new Set(nodeIds.filter((id) => id.trim()));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const connectedSourceHandles = new Set<string>();
  const rootNodes = nodes.filter(
    (node) => node.type === "START" || node.type === "TEMPLATE_TRIGGER",
  );

  if (rootNodes.length === 0) {
    errors.push(
      issue(
        "ERROR",
        "MISSING_START_NODE",
        "Flow must contain at least one Start or Template Trigger node.",
      ),
    );
  }

  duplicateNodeIds.forEach((nodeId) => {
    errors.push(
      issue("ERROR", "DUPLICATE_NODE_ID", `Duplicate node ID "${nodeId}" is not allowed.`, {
        nodeId,
      }),
    );
  });

  duplicateEdgeIds.forEach((edgeId) => {
    errors.push(
      issue("ERROR", "DUPLICATE_EDGE_ID", `Duplicate edge ID "${edgeId}" is not allowed.`, {
        edgeId,
      }),
    );
  });

  nodes.forEach((node) => validateNodeFields(node, errors));

  edges.forEach((edge) => {
    if (isBlank(edge.id)) {
      errors.push(
        issue("ERROR", "EDGE_ID_REQUIRED", "Every edge must have an ID.", {
          edgeId: edge.id,
        }),
      );
    }

    if (isBlank(edge.source) || isBlank(edge.target)) {
      errors.push(
        issue(
          "ERROR",
          "EDGE_SOURCE_TARGET_REQUIRED",
          "Every edge must have a source and target.",
          { edgeId: edge.id },
        ),
      );
    }

    if (edge.source === edge.target && edge.source.trim()) {
      errors.push(
        issue("ERROR", "SELF_LOOP_EDGE", "Self-loop edges are not allowed.", {
          edgeId: edge.id,
          nodeId: edge.source,
        }),
      );
    }

    if (edge.source && !nodeIdSet.has(edge.source)) {
      errors.push(
        issue(
          "ERROR",
          "BROKEN_EDGE_SOURCE",
          `Edge source "${edge.source}" does not reference an existing node.`,
          { edgeId: edge.id, nodeId: edge.source },
        ),
      );
    }

    if (edge.target && !nodeIdSet.has(edge.target)) {
      errors.push(
        issue(
          "ERROR",
          "BROKEN_EDGE_TARGET",
          `Edge target "${edge.target}" does not reference an existing node.`,
          { edgeId: edge.id, nodeId: edge.target },
        ),
      );
    }

    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);

    if (sourceNode) {
      const sourceHandle = resolveSourceHandleId(sourceNode, edge.sourceHandle);
      const outputHandleIds = new Set(
        getNodeOutputHandles(sourceNode).map((handle) => handle.id),
      );

      if (!sourceHandle) {
        errors.push(
          issue(
            "ERROR",
            "EDGE_SOURCE_HANDLE_REQUIRED",
            "Edge must choose a source output path.",
            { edgeId: edge.id, nodeId: edge.source },
          ),
        );
      } else if (!outputHandleIds.has(sourceHandle)) {
        errors.push(
          issue(
            "ERROR",
            "EDGE_SOURCE_HANDLE_INVALID",
            `Source path "${sourceHandle}" no longer exists.`,
            { edgeId: edge.id, nodeId: edge.source },
          ),
        );
      } else {
        const pathKey = `${edge.source}:${sourceHandle}`;
        if (connectedSourceHandles.has(pathKey)) {
          errors.push(
            issue(
              "ERROR",
              "DUPLICATE_SOURCE_HANDLE_EDGE",
              "Only one outgoing connection is allowed per source path.",
              { edgeId: edge.id, nodeId: edge.source },
            ),
          );
        }
        connectedSourceHandles.add(pathKey);
      }
    }

    if (targetNode) {
      const targetHandle = resolveTargetHandleId(targetNode, edge.targetHandle);
      const inputHandleIds = new Set(
        getNodeInputHandles(targetNode).map((handle) => handle.id),
      );

      if (!targetHandle) {
        errors.push(
          issue(
            "ERROR",
            "EDGE_TARGET_HANDLE_REQUIRED",
            "Edge must choose a target input.",
            { edgeId: edge.id, nodeId: edge.target },
          ),
        );
      } else if (!inputHandleIds.has(targetHandle)) {
        errors.push(
          issue(
            "ERROR",
            "EDGE_TARGET_HANDLE_INVALID",
            `Target input "${targetHandle}" no longer exists.`,
            { edgeId: edge.id, nodeId: edge.target },
          ),
        );
      }
    }
  });

  nodes.forEach((node) => {
    const incomingEdges = edges.filter((edge) => edge.target === node.id);
    const outgoingEdges = getOutgoingEdges(edges, node.id);

    if (
      (node.type === "START" || node.type === "TEMPLATE_TRIGGER") &&
      incomingEdges.length > 0
    ) {
      errors.push(
        issue(
          "ERROR",
          "ROOT_TRIGGER_HAS_INCOMING_EDGE",
          "Start and Template Trigger nodes cannot have incoming edges.",
          { nodeId: node.id, edgeId: incomingEdges[0]?.id },
        ),
      );
    }

    if (node.type === "END" && outgoingEdges.length > 0) {
      errors.push(
        issue(
          "ERROR",
          "END_HAS_OUTGOING_EDGE",
          "End node cannot have outgoing edges.",
          { nodeId: node.id, edgeId: outgoingEdges[0]?.id },
        ),
      );
    }

    validateBranchWarnings(node, outgoingEdges, warnings);
  });

  if (rootNodes.length > 0) {
    const isStartEndPlaceholder =
      nodes.length === 2 &&
      rootNodes.length === 1 &&
      nodes.some((node) => node.type === "END");

    rootNodes.forEach((rootNode) => {
      const rootOutgoingEdges = getOutgoingEdges(edges, rootNode.id);

      if (rootOutgoingEdges.length === 0 && !isStartEndPlaceholder) {
        errors.push(
          issue(
            "ERROR",
            "START_MISSING_OUTGOING_EDGE",
            "Start or Template Trigger node must have at least one outgoing edge.",
            { nodeId: rootNode.id },
          ),
        );
      }
    });

    const reachable = new Set<string>(rootNodes.map((node) => node.id));
    const queue = rootNodes.map((node) => node.id);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;

      edges
        .filter(
          (edge) =>
            edge.source === current &&
            edge.target &&
            nodeIdSet.has(edge.target) &&
            !reachable.has(edge.target),
        )
        .forEach((edge) => {
          reachable.add(edge.target);
          queue.push(edge.target);
        });
    }

    nodes.forEach((node) => {
      if (
        node.type !== "START" &&
        node.type !== "TEMPLATE_TRIGGER" &&
        knownNodeTypes.has(node.type) &&
        !reachable.has(node.id)
      ) {
        errors.push(
          issue(
            "ERROR",
            "UNREACHABLE_NODE",
            `Node "${node.data.label || node.id}" is not reachable from Start.`,
            { nodeId: node.id },
          ),
        );
      }
    });
  }

  return {
    errors,
    valid: errors.length === 0,
    warnings,
  };
}
