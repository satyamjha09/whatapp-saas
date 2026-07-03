import type { TemplateVariableMapping } from "@/lib/automation-builder/types";
import {
  buildTemplatePreview as buildSharedTemplatePreview,
  type WhatsAppTemplateLike,
} from "@/lib/whatsapp-template/template-variable-parser";

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

type TemplateLike = WhatsAppTemplateLike;

function sampleForMapping(mapping: TemplateVariableMapping) {
  if (mapping.sourceValue.trim()) {
    if (mapping.sourceType === "STATIC") return mapping.sourceValue;
    if (mapping.sourceType === "CONTACT_FIELD") {
      const samples: Record<string, string> = {
        "contact.companyName": "metawhat",
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

function sampleValuesForMappings(mappings: TemplateVariableMapping[]) {
  return mappings.reduce<Record<string, string>>((values, mapping) => {
    const sample = sampleForMapping(mapping);

    values[mapping.variableName] = sample;
    values[`${mapping.component}_${mapping.variableName}`] = sample;

    if (mapping.component === "BUTTON") {
      values[`BUTTON_${mapping.index}_${mapping.variableName}`] = sample;
    }

    return values;
  }, {});
}

export function buildTemplatePreview(
  template: TemplateLike,
  mappings: TemplateVariableMapping[] = [],
  mediaUrl?: string,
): TemplatePreview {
  const preview = buildSharedTemplatePreview(
    template,
    sampleValuesForMappings(mappings),
  );

  return {
    ...preview,
    mediaUrl: mediaUrl?.trim() || undefined,
  };
}
