export const automationNodeTypes = [
  "START",
  "TEMPLATE_TRIGGER",
  "SEND_MESSAGE",
  "QUICK_REPLY",
  "LIST_MESSAGE",
  "CONDITION",
  "SEND_TEMPLATE",
  "WAIT_FOR_REPLY",
  "BUTTON_REPLY_ROUTER",
  "API_CALL",
  "HUMAN_HANDOFF",
  "ADD_TAG",
  "REMOVE_TAG",
  "UPDATE_CONTACT_FIELD",
  "DELAY",
  "WEBHOOK",
  "GOOGLE_SHEET_APPEND_ROW",
  "GOOGLE_SHEET_UPDATE_ROW",
  "TALLY_LOOKUP",
  "PAYMENT_LINK",
  "CATALOG_SEND",
  "AI_REPLY",
  "FALLBACK",
  "RETRY",
  "ERROR_HANDLER",
  "END",
] as const;

export type AutomationNodeType = (typeof automationNodeTypes)[number];

export type AutomationGraph = {
  version: 1;
  nodes: AutomationNode[];
  edges: AutomationEdge[];
};

export type AutomationNode = {
  id: string;
  type: AutomationNodeType;
  position: {
    x: number;
    y: number;
  };
  data: AutomationNodeData;
};

export type AutomationEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
};

export type StartNodeData = {
  label: string;
  triggerType:
    | "KEYWORD"
    | "DEFAULT"
    | "TEMPLATE_REPLY"
    | "BUTTON_REPLY"
    | "WEBHOOK"
    | "MANUAL";
  keywords: string[];
};

export type SendMessageNodeData = {
  label: string;
  messageText: string;
  mediaUrl?: string;
};

export type QuickReplyButton = {
  id: string;
  label: string;
};

export type QuickReplyNodeData = {
  label: string;
  bodyText: string;
  buttons: QuickReplyButton[];
};

export type ListMessageItem = {
  id: string;
  title: string;
  description?: string;
};

export type ListMessageSection = {
  id: string;
  title: string;
  items: ListMessageItem[];
};

export type ListMessageNodeData = {
  label: string;
  bodyText: string;
  buttonText: string;
  sections: ListMessageSection[];
};

export type ConditionNodeData = {
  label: string;
  variable: string;
  operator:
    | "EQUALS"
    | "NOT_EQUALS"
    | "CONTAINS"
    | "NOT_CONTAINS"
    | "GREATER_THAN"
    | "LESS_THAN"
    | "IS_EMPTY"
    | "IS_NOT_EMPTY";
  value?: string | number | boolean;
};

export type TemplateVariableMapping = {
  variableName: string;
  component: "HEADER" | "BODY" | "BUTTON";
  index: number;
  sourceType:
    | "CONTACT_FIELD"
    | "STATIC"
    | "SESSION_CONTEXT"
    | "PREVIOUS_NODE_OUTPUT"
    | "CUSTOM_ATTRIBUTE";
  sourceValue: string;
  fallbackValue?: string;
};

export type TemplateTriggerNodeData = {
  label: string;
  triggerName: string;
  triggerMode:
    | "ANY_TEMPLATE_REPLY"
    | "SPECIFIC_TEMPLATE_REPLY"
    | "SPECIFIC_CAMPAIGN_REPLY"
    | "BUTTON_REPLY"
    | "TEXT_REPLY";
  templateId?: string;
  campaignId?: string;
  keywords: string[];
  buttonIds: string[];
};

export type SendTemplateNodeData = {
  label: string;
  templateId: string;
  templateName?: string;
  templateStatus?: string;
  languageCode: string;
  category?: string;
  headerType?: "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  headerVariableMappings: TemplateVariableMapping[];
  bodyVariableMappings: TemplateVariableMapping[];
  buttonVariableMappings: TemplateVariableMapping[];
  mediaUrl?: string;
  fallbackMessage?: string;
};

export type WaitForReplyNodeData = {
  label: string;
  timeoutMinutes: number;
  saveReplyAs: string;
  acceptedReplyType: "TEXT" | "BUTTON" | "LIST" | "ANY";
  timeoutMessage?: string;
};

export type ButtonReplyRoute = {
  buttonId: string;
  buttonLabel: string;
};

export type ButtonReplyRouterNodeData = {
  label: string;
  sourceNodeId: string;
  routes: ButtonReplyRoute[];
  fallbackEnabled: boolean;
};

export type ApiHeader = {
  key: string;
  value: string;
  secret?: boolean;
};

export type ApiResponseMapping = {
  responsePath: string;
  saveAs: string;
};

export type AutomationValueSourceType =
  | "CONTACT_FIELD"
  | "STATIC"
  | "SESSION_CONTEXT"
  | "PREVIOUS_NODE_OUTPUT"
  | "CUSTOM_ATTRIBUTE";

export type AutomationValueSource = {
  sourceType: AutomationValueSourceType;
  sourceValue: string;
  fallbackValue?: string;
};

export type AutomationColumnMapping = AutomationValueSource & {
  columnName: string;
};

export type WebhookNodeData = {
  label: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  headers: ApiHeader[];
  body?: string;
  timeoutMs: number;
  retryCount: number;
  authMode: "NONE" | "API_KEY" | "BEARER_TOKEN" | "BASIC";
  authConfig?: {
    headerName?: string;
    tokenSecretId?: string;
    usernameSecretId?: string;
    passwordSecretId?: string;
  };
  responseMapping: ApiResponseMapping[];
  mockResponse?: unknown;
};

export type ApiCallNodeData = {
  label: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  headers: ApiHeader[];
  body?: string;
  responseMapping: ApiResponseMapping[];
};

export type GoogleSheetAppendRowNodeData = {
  label: string;
  connectedGoogleAccountId: string;
  spreadsheetId: string;
  sheetName: string;
  columnMappings: AutomationColumnMapping[];
};

export type GoogleSheetUpdateRowNodeData = {
  label: string;
  connectedGoogleAccountId: string;
  spreadsheetId: string;
  sheetName: string;
  lookupColumn: string;
  lookupValueSource: AutomationValueSource;
  updateMappings: AutomationColumnMapping[];
};

export type TallyLookupNodeData = {
  label: string;
  lookupType:
    | "LEDGER_BALANCE"
    | "INVOICE_STATUS"
    | "STOCK_ITEM"
    | "CUSTOMER_DUES"
    | "CUSTOMER_LEDGER"
    | "SALES_ORDER_STATUS";
  customerIdentifierSource: AutomationValueSource;
  invoiceNumberSource?: AutomationValueSource;
  stockItemSource?: AutomationValueSource;
  saveResultAs: string;
  mockResult?: unknown;
};

export type PaymentLinkNodeData = {
  label: string;
  provider: "CASHFREE";
  amountSource: AutomationValueSource;
  currency: "INR";
  customerNameSource: AutomationValueSource;
  customerPhoneSource: AutomationValueSource;
  customerEmailSource?: AutomationValueSource;
  purpose: string;
  savePaymentLinkAs: string;
  expiryMinutes: number;
  mockPaymentLink?: string;
};

export type CatalogSendNodeData = {
  label: string;
  catalogSource: "WHATSAPP_CATALOG" | "TALLY_STOCK" | "MANUAL_PRODUCTS";
  catalogId?: string;
  productIds: string[];
  categoryFilter?: string;
  maxProducts: number;
  fallbackText?: string;
};

export type AiReplyNodeData = {
  label: string;
  agentId?: string;
  systemInstruction: string;
  knowledgeBaseIds: string[];
  userMessageSource: {
    sourceType:
      | "TRIGGER_MESSAGE"
      | "SESSION_CONTEXT"
      | "PREVIOUS_NODE_OUTPUT"
      | "STATIC";
    sourceValue: string;
  };
  saveReplyAs: string;
  confidenceThreshold: number;
  fallbackMessage: string;
  maxTokens: number;
  mockResponse?: {
    confidence?: number;
    text?: string;
  };
};

export type FallbackNodeData = {
  label: string;
  fallbackMessage: string;
  nextAction: "SEND_MESSAGE" | "HUMAN_HANDOFF" | "END";
};

export type RetryNodeData = {
  label: string;
  maxRetries: number;
  retryDelaySeconds: number;
  retryTargetNodeId: string;
  onMaxRetriesAction: "ERROR_PATH" | "HUMAN_HANDOFF" | "END";
};

export type ErrorHandlerNodeData = {
  label: string;
  errorMessageToCustomer?: string;
  notifyTeam: boolean;
  openInbox: boolean;
  endSession: boolean;
};

export type HumanHandoffNodeData = {
  label: string;
  inboxPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assignmentMode: "UNASSIGNED" | "ROUND_ROBIN" | "SPECIFIC_USER";
  assignedUserId?: string;
  messageToCustomer: string;
};

export type AddTagNodeData = {
  label: string;
  tagName: string;
};

export type RemoveTagNodeData = {
  label: string;
  tagName: string;
};

export type UpdateContactFieldNodeData = {
  label: string;
  fieldName: string;
  fieldValue: string;
};

export type DelayNodeData = {
  label: string;
  duration: number;
  unit: "SECONDS" | "MINUTES" | "HOURS" | "DAYS";
};

export type EndNodeData = {
  label: string;
  endReason?: string;
};

export type AutomationNodeData =
  | StartNodeData
  | TemplateTriggerNodeData
  | SendMessageNodeData
  | QuickReplyNodeData
  | ListMessageNodeData
  | ConditionNodeData
  | SendTemplateNodeData
  | WaitForReplyNodeData
  | ButtonReplyRouterNodeData
  | ApiCallNodeData
  | HumanHandoffNodeData
  | AddTagNodeData
  | RemoveTagNodeData
  | UpdateContactFieldNodeData
  | DelayNodeData
  | WebhookNodeData
  | GoogleSheetAppendRowNodeData
  | GoogleSheetUpdateRowNodeData
  | TallyLookupNodeData
  | PaymentLinkNodeData
  | CatalogSendNodeData
  | AiReplyNodeData
  | FallbackNodeData
  | RetryNodeData
  | ErrorHandlerNodeData
  | EndNodeData;

export type AutomationGraphValidationSeverity = "ERROR" | "WARNING";

export type AutomationGraphValidationIssue = {
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
  severity: AutomationGraphValidationSeverity;
};

export type AutomationGraphValidationResult = {
  valid: boolean;
  errors: AutomationGraphValidationIssue[];
  warnings: AutomationGraphValidationIssue[];
};

export type AutomationNodeIconName =
  | "play"
  | "trigger"
  | "message"
  | "buttons"
  | "router"
  | "list"
  | "branch"
  | "template"
  | "wait"
  | "api"
  | "handoff"
  | "tag"
  | "contact"
  | "delay"
  | "sheet"
  | "tally"
  | "payment"
  | "catalog"
  | "ai"
  | "fallback"
  | "retry"
  | "error"
  | "webhook"
  | "end";

export function isAutomationNodeType(
  value: unknown,
): value is AutomationNodeType {
  return automationNodeTypes.includes(value as AutomationNodeType);
}
