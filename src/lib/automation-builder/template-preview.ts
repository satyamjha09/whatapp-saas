import type { TemplateVariableMapping } from "@/lib/automation-builder/types";
import {
  extractTemplateVariables,
  readTemplateComponents,
  type TemplateHeaderType,
  type TemplateLike,
} from "@/lib/automation-builder/template-variables";

export type TemplatePreview = {
  headerText?: string;
  bodyText: string;
  footerText?: string;
  buttons: Array<{
    type: string;
    text: string;
  }>;
  mediaType?: string;
  mediaUrl?: string;
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function sampleForMapping(mapping: TemplateVariableMapping) {
  if (mapping.sourceValue.trim()) {
    if (mapping.sourceType === "STATIC") return mapping.sourceValue;
    if (mapping.sourceType === "CONTACT_FIELD") {
      const samples: Record<string, string> = {
        "contact.companyName": "TallyKonnect",
        "contact.countryCode": "91",
        "contact.email": "customer@example.com",
        "contact.name": "Satyam Jha",
        "contact.phoneNumber": "8810386013",
        "contact.tags": "lead, whatsapp",
      };

      return samples[mapping.sourceValue] ?? `{{${mapping.sourceValue}}}`;
    }

    return `{{${mapping.sourceValue}}}`;
  }

  if (mapping.fallbackValue?.trim()) return mapping.fallbackValue;

  return `{{${mapping.variableName}}}`;
}

function replaceVariables(
  text: string,
  component: TemplateVariableMapping["component"],
  mappings: TemplateVariableMapping[] = [],
) {
  return text.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, variableName) => {
    const mapping = mappings.find(
      (item) =>
        item.component === component &&
        item.variableName === String(variableName).trim(),
    );

    return mapping ? sampleForMapping(mapping) : match;
  });
}

function getHeaderType(template: TemplateLike): TemplateHeaderType {
  return extractTemplateVariables(template).headerType;
}

export function buildTemplatePreview(
  template: TemplateLike,
  mappings: TemplateVariableMapping[] = [],
  mediaUrl?: string,
): TemplatePreview {
  const components = readTemplateComponents(template);
  const headerComponent = components.find(
    (component) => stringValue(component.type).toUpperCase() === "HEADER",
  );
  const bodyComponent = components.find(
    (component) => stringValue(component.type).toUpperCase() === "BODY",
  );
  const footerComponent = components.find(
    (component) => stringValue(component.type).toUpperCase() === "FOOTER",
  );
  const buttonsComponent = components.find(
    (component) => stringValue(component.type).toUpperCase() === "BUTTONS",
  );
  const headerType = getHeaderType(template);
  const buttons = Array.isArray(buttonsComponent?.buttons)
    ? buttonsComponent.buttons
        .filter((button): button is Record<string, unknown> =>
          Boolean(button) && typeof button === "object",
        )
        .map((button) => ({
          text: replaceVariables(
            stringValue(button.text || button.title || button.url || "Button"),
            "BUTTON",
            mappings,
          ),
          type: stringValue(button.type || button.sub_type || "QUICK_REPLY"),
        }))
    : [];

  return {
    bodyText: replaceVariables(
      stringValue(bodyComponent?.text ?? template.body ?? ""),
      "BODY",
      mappings,
    ),
    buttons,
    footerText: footerComponent?.text,
    headerText:
      headerType === "TEXT"
        ? replaceVariables(stringValue(headerComponent?.text), "HEADER", mappings)
        : undefined,
    mediaType: headerType === "NONE" || headerType === "TEXT" ? undefined : headerType,
    mediaUrl: mediaUrl?.trim() || undefined,
  };
}
