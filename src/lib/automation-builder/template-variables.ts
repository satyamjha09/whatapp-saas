import {
  extractTemplateVariableMetadata,
  extractVariablesFromText,
  readTemplateComponents,
  type WhatsAppTemplateComponent,
  type WhatsAppTemplateHeaderType,
  type WhatsAppTemplateLike,
} from "@/lib/whatsapp-template/template-variable-parser";

export type TemplateHeaderType = WhatsAppTemplateHeaderType;

export type TemplateVariableMetadataItem = {
  variableName: string;
  index: number;
  example?: string;
};

export type TemplateButtonVariableMetadataItem =
  TemplateVariableMetadataItem & {
    buttonIndex: number;
    buttonType: string;
  };

export type TemplateVariableMetadata = {
  header: TemplateVariableMetadataItem[];
  body: TemplateVariableMetadataItem[];
  buttons: TemplateButtonVariableMetadataItem[];
  mediaRequired: boolean;
  headerType: TemplateHeaderType;
};

export type TemplateLike = WhatsAppTemplateLike;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

export { extractVariablesFromText, readTemplateComponents };

function readButtons(components: WhatsAppTemplateComponent[]) {
  const buttons = components.find(
    (component) => stringValue(component.type).toUpperCase() === "BUTTONS",
  );

  return Array.isArray(buttons?.buttons) ? buttons.buttons : [];
}

export function extractTemplateVariables(
  template: TemplateLike,
): TemplateVariableMetadata {
  const components = readTemplateComponents(template);
  const metadata = extractTemplateVariableMetadata(template);
  const buttons = readButtons(components);

  return {
    body: metadata.variables
      .filter((variable) => variable.component === "BODY")
      .map((variable) => ({
        example: variable.example,
        index: variable.index,
        variableName: variable.variableName,
      })),
    buttons: metadata.variables
      .filter((variable) => variable.component === "BUTTON")
      .map((variable) => {
        const button = buttons[variable.buttonIndex ?? 0];
        const buttonType = isRecord(button)
          ? stringValue(button.type || button.sub_type || "URL")
          : "URL";

        return {
          buttonIndex: variable.buttonIndex ?? 0,
          buttonType,
          example: variable.example,
          index: variable.index,
          variableName: variable.variableName,
        };
      }),
    header: metadata.variables
      .filter((variable) => variable.component === "HEADER")
      .map((variable) => ({
        example: variable.example,
        index: variable.index,
        variableName: variable.variableName,
      })),
    headerType: metadata.headerType,
    mediaRequired: metadata.mediaRequired,
  };
}
