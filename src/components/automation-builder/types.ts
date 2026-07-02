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
  acceptedReplyType?: string;
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
  category?: string;
  duration?: number;
  endReason?: string;
  fallbackEnabled?: boolean;
  fallbackMessage?: string;
  fieldName?: string;
  fieldValue?: string;
  headerType?: string;
  headerVariableMappings?: TemplateVariableMapping[] | string;
  headers?: ApiHeader[] | string;
  inboxPriority?: string;
  keywords?: string[];
  label: string;
  languageCode?: string;
  mediaUrl?: string;
  messageText?: string;
  messageToCustomer?: string;
  method?: string;
  operator?: string;
  responseMapping?: ApiResponseMapping[] | string;
  saveReplyAs?: string;
  routes?: ButtonReplyRoute[] | string;
  sections?: ListMessageSection[] | string;
  sourceNodeId?: string;
  tagName?: string;
  templateId?: string;
  templateName?: string;
  templateStatus?: string;
  timeoutMessage?: string;
  timeoutMinutes?: number;
  triggerMode?: string;
  triggerName?: string;
  triggerType?: string;
  unit?: string;
  url?: string;
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
