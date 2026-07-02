import type { AutomationGraph } from "../automation-builder/types";

export type AutomationFlowTemplateCategory =
  | "PAYMENTS"
  | "LEAD_GENERATION"
  | "DEMO_BOOKING"
  | "ORDER_STATUS"
  | "CUSTOMER_SUPPORT"
  | "FEEDBACK"
  | "TALLY"
  | "COMMERCE";

export type AutomationFlowTemplateDifficulty =
  | "BEGINNER"
  | "INTERMEDIATE"
  | "ADVANCED";

export type AutomationFlowTemplateRequirementType =
  | "WHATSAPP_TEMPLATE"
  | "TALLY_CONNECTION"
  | "GOOGLE_CONNECTION"
  | "CASHFREE"
  | "CATALOG"
  | "AI_AGENT";

export type AutomationFlowTemplateRequirement = {
  type: AutomationFlowTemplateRequirementType;
  label: string;
  required: boolean;
  description?: string;
};

export type RequiredWhatsAppTemplate = {
  key: string;
  label: string;
  purpose: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  exampleBody: string;
  requiredVariables: Array<{
    name: string;
    description: string;
  }>;
};

export type AutomationTemplateSetupChecklistItem = {
  key: string;
  title: string;
  description: string;
  required: boolean;
  completedBy?: "TEMPLATE_MAPPING" | "INTEGRATION_MAPPING" | "VARIABLE_MAPPING" | "TEST_RUN" | "PUBLISH";
};

export type AutomationFlowTemplate = {
  slug: string;
  name: string;
  description: string;
  category: AutomationFlowTemplateCategory;
  difficulty: AutomationFlowTemplateDifficulty;
  estimatedSetupMinutes: number;
  tags: string[];
  bestFor: string[];
  requiredIntegrations: AutomationFlowTemplateRequirement[];
  requiredWhatsAppTemplates: RequiredWhatsAppTemplate[];
  nodesIncluded: string[];
  graph: AutomationGraph;
  setupChecklist: AutomationTemplateSetupChecklistItem[];
  exampleConversation: Array<{
    from: "business" | "customer" | "system";
    text: string;
  }>;
};
