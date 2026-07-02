import type { AutomationFlowTemplate } from "./template-types";
import { validateAutomationGraph } from "../automation-builder/graph-validation";

export type TemplateValidationIssue = {
  severity: "ERROR" | "WARNING";
  message: string;
};

export function validateAutomationFlowTemplate(
  template: AutomationFlowTemplate,
  allTemplates: AutomationFlowTemplate[] = [],
): TemplateValidationIssue[] {
  const issues: TemplateValidationIssue[] = [];

  // 1. Slug check
  if (!template.slug || !template.slug.trim()) {
    issues.push({ severity: "ERROR", message: "Template slug is required." });
  } else {
    const duplicates = allTemplates.filter((t) => t.slug === template.slug);
    if (duplicates.length > 1) {
      issues.push({
        severity: "ERROR",
        message: `Template slug "${template.slug}" is not unique.`,
      });
    }
  }

  // 2. Name check
  if (!template.name || !template.name.trim()) {
    issues.push({ severity: "ERROR", message: "Template name is required." });
  }

  // 3. Category check
  const validCategories = new Set([
    "PAYMENTS",
    "LEAD_GENERATION",
    "DEMO_BOOKING",
    "ORDER_STATUS",
    "CUSTOMER_SUPPORT",
    "FEEDBACK",
    "TALLY",
    "COMMERCE",
  ]);
  if (!validCategories.has(template.category)) {
    issues.push({
      severity: "ERROR",
      message: `Invalid category "${template.category}".`,
    });
  }

  // 4. Difficulty check
  const validDifficulties = new Set(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
  if (!validDifficulties.has(template.difficulty)) {
    issues.push({
      severity: "ERROR",
      message: `Invalid difficulty "${template.difficulty}".`,
    });
  }

  // 5. WhatsApp Template keys check
  const wabaKeys = template.requiredWhatsAppTemplates.map((w) => w.key);
  const uniqueWabaKeys = new Set(wabaKeys);
  if (wabaKeys.length !== uniqueWabaKeys.size) {
    issues.push({
      severity: "ERROR",
      message: "Required WhatsApp template keys must be unique.",
    });
  }

  // 6. Graph validation
  if (!template.graph) {
    issues.push({ severity: "ERROR", message: "Template graph is missing." });
    return issues;
  }

  const graphValidation = validateAutomationGraph(template.graph);
  graphValidation.errors.forEach((err) => {
    issues.push({
      severity: "ERROR",
      message: `Graph validation error: ${err.message}`,
    });
  });

  // 7. Placeholder validation: check if templates/integrations referenced in graph match declared requirements
  const graphText = JSON.stringify(template.graph);

  template.requiredWhatsAppTemplates.forEach((w) => {
    const placeholder = `{{WHATSAPP_TEMPLATE_${w.key.toUpperCase()}}}`;
    if (!graphText.includes(placeholder)) {
      issues.push({
        severity: "WARNING",
        message: `Placeholder "${placeholder}" for required WhatsApp template "${w.key}" was not found in the graph.`,
      });
    }
  });

  template.requiredIntegrations.forEach((integration) => {
    let expectedPlaceholder = "";
    if (integration.type === "GOOGLE_CONNECTION") {
      expectedPlaceholder = "{{GOOGLE_CONNECTION_ID}}";
    } else if (integration.type === "TALLY_CONNECTION") {
      expectedPlaceholder = "{{TALLY_CONNECTION_ID}}";
    } else if (integration.type === "CASHFREE") {
      expectedPlaceholder = "{{CASHFREE_PROVIDER}}";
    }

    if (expectedPlaceholder && !graphText.includes(expectedPlaceholder)) {
      issues.push({
        severity: "WARNING",
        message: `Placeholder "${expectedPlaceholder}" for integration "${integration.type}" was not found in the graph.`,
      });
    }
  });

  return issues;
}
