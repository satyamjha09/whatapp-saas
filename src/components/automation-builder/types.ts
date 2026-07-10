import type { Dispatch, SetStateAction } from "react";
import type {
  ApiHeader,
  ApiResponseMapping,
  AutomationNodeType,
  ButtonReplyRoute,
  ListMessageSection,
  QuickReplyButton,
  TemplateVariableMapping,
} from "@/lib/automation-builder/types";

export * from "@/lib/automation-builder/types";
export {
  createDefaultAutomationGraph,
  createDefaultNodeData,
  normalizeAutomationGraph,
  normalizeAutomationNodeData,
} from "@/lib/automation-builder/node-defaults";
export {
  getAutomationNodeDescription,
  getAutomationNodeIcon,
  getAutomationNodeLabel,
} from "@/lib/automation-builder/node-labels";

export type AutomationEditableNodeData = {
  [key: string]: unknown;
  acceptedReplyType?: string;
  amountSource?: unknown;
  authConfig?: unknown;
  authMode?: string;
  assignedUserId?: string;
  assignmentMode?: string;
  body?: string;
  bodyVariableMappings?: TemplateVariableMapping[] | string;
  bodyText?: string;
  buttonIds?: string[];
  buttonVariableMappings?: TemplateVariableMapping[] | string;
  buttonText?: string;
  buttons?: QuickReplyButton[] | string;
  campaignId?: string;
  catalogId?: string;
  catalogSource?: string;
  category?: string;
  categoryFilter?: string;
  columnMappings?: unknown;
  confidenceThreshold?: number;
  connectedGoogleAccountId?: string;
  conversionGoalNodeId?: string;
  currency?: string;
  customerEmailSource?: unknown;
  customerIdentifierSource?: unknown;
  customerNameSource?: unknown;
  customerPhoneSource?: unknown;
  duration?: number;
  endSession?: boolean;
  endReason?: string;
  errorMessageToCustomer?: string;
  expiryMinutes?: number;
  fallbackEnabled?: boolean;
  fallbackMessage?: string;
  fieldName?: string;
  fieldValue?: string;
  headerType?: string;
  headerVariableMappings?: TemplateVariableMapping[] | string;
  headers?: ApiHeader[] | string;
  inboxPriority?: string;
  invoiceNumberSource?: unknown;
  keywords?: string[];
  knowledgeBaseIds?: string[] | string;
  label: string;
  languageCode?: string;
  lookupColumn?: string;
  lookupType?: string;
  lookupValueSource?: unknown;
  maxProducts?: number;
  maxRetries?: number;
  maxTokens?: number;
  mediaUrl?: string;
  messageText?: string;
  messageToCustomer?: string;
  method?: string;
  mockPaymentLink?: string;
  mockResponse?: unknown;
  mockResult?: unknown;
  nextAction?: string;
  notifyTeam?: boolean;
  onMaxRetriesAction?: string;
  openInbox?: boolean;
  operator?: string;
  productIds?: string[];
  provider?: string;
  purpose?: string;
  responseMapping?: ApiResponseMapping[] | string;
  retryCount?: number;
  retryDelaySeconds?: number;
  retryTargetNodeId?: string;
  saveReplyAs?: string;
  savePaymentLinkAs?: string;
  saveResultAs?: string;
  routes?: ButtonReplyRoute[] | string;
  sections?: ListMessageSection[] | string;
  sheetName?: string;
  sourceNodeId?: string;
  spreadsheetId?: string;
  tagName?: string;
  templateId?: string;
  templateName?: string;
  templateStatus?: string;
  timeoutMessage?: string;
  timeoutMinutes?: number;
  timeoutMs?: number;
  triggerMode?: string;
  triggerName?: string;
  triggerType?: string;
  unit?: string;
  updateMappings?: unknown;
  url?: string;
  userMessageSource?: unknown;
  value?: string | number | boolean;
  variable?: string;
  variableMappings?: TemplateVariableMapping[] | string;
};

export type AutomationFlowNodeData = AutomationEditableNodeData & {
  nodeType: AutomationNodeType;
  testIsCurrent?: boolean;
  testStatus?: "RUNNING" | "SUCCESS" | "FAILED" | "WAITING" | "SKIPPED";
  validationIssueCount?: number;
  validationSeverity?: "ERROR" | "WARNING";
};

export type NodeFormProps = {
  draft: AutomationEditableNodeData;
  errors: Record<string, string>;
  setDraft: Dispatch<SetStateAction<AutomationEditableNodeData>>;
};
