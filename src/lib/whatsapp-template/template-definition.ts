import {
  extractTemplateVariableMetadata,
  readTemplateComponents,
  serializeTemplateVariables,
  type WhatsAppTemplateComponent,
  type WhatsAppTemplateLike,
  type WhatsAppTemplateVariable,
} from "@/lib/whatsapp-template/template-variable-parser";
import {
  buildMetaTemplateButton,
  readTemplateButtonDraft,
  type TemplateButtonType,
} from "@/lib/whatsapp-template/template-button-rules";

export const TEMPLATE_TYPES = [
  "STANDARD",
  "MEDIA",
  "CAROUSEL",
  "CATALOG",
  "FLOW",
  "PAYMENT",
] as const;

export const TEMPLATE_CATEGORIES = [
  "MARKETING",
  "UTILITY",
  "AUTHENTICATION",
] as const;

export const TEMPLATE_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "PAUSED",
  "IN_APPEAL",
  "PENDING_DELETION",
  "DELETED",
  "DISABLED",
  "LIMIT_EXCEEDED",
] as const;

export type TemplateType = (typeof TEMPLATE_TYPES)[number];
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

export type TemplateVariableExample = {
  component: WhatsAppTemplateVariable["component"];
  key: string;
  value: string;
  buttonIndex?: number;
};

export type TemplateButtonDefinition = {
  type: TemplateButtonType;
  text?: string;
  url?: string;
  phoneNumber?: string;
  copyCode?: string;
  flowId?: string;
  navigateScreen?: string;
  paymentConfigId?: string;
};

export type TemplateHeaderDefinition = {
  format: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION" | "NONE";
  text?: string;
  mediaAssetId?: string;
  mediaFileName?: string;
  mediaUrl?: string;
  metaHandle?: string;
  example?: unknown;
};

export type CanonicalTemplateDraft = {
  templateType: TemplateType;
  templateCategory: TemplateCategory;
  templateName: string;
  languageCode: string;
  status: TemplateStatus;
  metaTemplateId: string | null;
  header: TemplateHeaderDefinition | null;
  body: string;
  footer: string | null;
  buttons: TemplateButtonDefinition[];
  variables: string[];
  examples: TemplateVariableExample[];
  rejectionReason: string | null;
  qualityStatus: string | null;
  submittedAt: Date | string | null;
  approvedAt: Date | string | null;
  lastSyncedAt: Date | string | null;
  components: WhatsAppTemplateComponent[];
};

type TemplateRecordLike = WhatsAppTemplateLike & {
  name?: string | null;
  templateName?: string | null;
  language?: string | null;
  languageCode?: string | null;
  category?: string | null;
  templateCategory?: string | null;
  status?: string | null;
  metaTemplateId?: string | null;
  rejectionReason?: string | null;
  qualityScore?: string | null;
  qualityStatus?: string | null;
  lastSubmittedAt?: Date | string | null;
  submittedAt?: Date | string | null;
  approvedAt?: Date | string | null;
  lastSyncedAt?: Date | string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function cleanNullableString(value: unknown) {
  const text = stringValue(value).trim();
  return text ? text : null;
}

function normalizeEnum<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number],
): T[number] {
  const normalized = stringValue(value).trim().toUpperCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function componentType(component: WhatsAppTemplateComponent) {
  return stringValue(component.type).toUpperCase();
}

function cleanMetaComponent(component: WhatsAppTemplateComponent) {
  const cleaned: WhatsAppTemplateComponent = {};

  if (component.type) cleaned.type = component.type;
  if (component.format) cleaned.format = component.format;
  if (component.text) cleaned.text = component.text;
  if (component.example) cleaned.example = component.example;
  if (component.buttons) {
    cleaned.buttons = component.buttons
      .map((button) => buildMetaTemplateButton(button))
      .filter(Boolean);
  }
  if (component.cards) cleaned.cards = component.cards;

  if (
    componentType(component) === "HEADER" &&
    ["IMAGE", "VIDEO", "DOCUMENT"].includes(stringValue(component.format).toUpperCase())
  ) {
    const metaHandle =
      typeof component.metaHandle === "string" ? component.metaHandle.trim() : "";

    if (metaHandle && !cleaned.example) {
      cleaned.example = {
        header_handle: [metaHandle],
      };
    }
  }

  return cleaned;
}

function readTemplateType(components: unknown): TemplateType {
  if (isRecord(components)) {
    return normalizeEnum(components.templateType, TEMPLATE_TYPES, "STANDARD");
  }

  return "STANDARD";
}

function readButtons(component: WhatsAppTemplateComponent | undefined) {
  if (!Array.isArray(component?.buttons)) return [];

  return component.buttons.filter(isRecord).map((button) => {
    const draft = readTemplateButtonDraft(button);

    return {
      ...(draft.copyCode ? { copyCode: draft.copyCode } : {}),
      ...(draft.flowId ? { flowId: draft.flowId } : {}),
      ...(draft.navigateScreen ? { navigateScreen: draft.navigateScreen } : {}),
      ...(draft.paymentConfigId ? { paymentConfigId: draft.paymentConfigId } : {}),
      ...(draft.phoneNumber ? { phoneNumber: draft.phoneNumber } : {}),
      ...(draft.text ? { text: draft.text } : {}),
      type: draft.type,
      ...(draft.url ? { url: draft.url } : {}),
    };
  });
}

function examplesFromVariables(
  variables: WhatsAppTemplateVariable[],
): TemplateVariableExample[] {
  return variables
    .filter((variable) => typeof variable.example === "string")
    .map((variable) => ({
      buttonIndex: variable.buttonIndex,
      component: variable.component,
      key:
        variable.component === "BUTTON"
          ? `BUTTON_${variable.buttonIndex ?? 0}_${variable.variableName}`
          : `${variable.component}_${variable.variableName}`,
      value: variable.example ?? "",
    }));
}

export function canonicalizeTemplateDraft(
  template: TemplateRecordLike,
): CanonicalTemplateDraft {
  const components = readTemplateComponents(template);
  const headerComponent = components.find(
    (component) => componentType(component) === "HEADER",
  );
  const bodyComponent = components.find(
    (component) => componentType(component) === "BODY",
  );
  const footerComponent = components.find(
    (component) => componentType(component) === "FOOTER",
  );
  const buttonComponent = components.find(
    (component) => componentType(component) === "BUTTONS",
  );
  const metadata = extractTemplateVariableMetadata(template);
  const body = stringValue(bodyComponent?.text ?? template.body);

  return {
    approvedAt: template.approvedAt ?? null,
    body,
    buttons: readButtons(buttonComponent),
    components,
    examples: examplesFromVariables(metadata.variables),
    footer: cleanNullableString(footerComponent?.text),
    header: headerComponent
      ? {
          example: headerComponent.example,
          format: normalizeEnum(
            headerComponent.format,
            ["TEXT", "IMAGE", "VIDEO", "DOCUMENT", "LOCATION", "NONE"] as const,
            "NONE",
          ),
          mediaAssetId: cleanNullableString(headerComponent.mediaAssetId) ?? undefined,
          mediaFileName:
            cleanNullableString(headerComponent.fileName) ??
            cleanNullableString(headerComponent.mediaFileName) ??
            undefined,
          mediaUrl:
            cleanNullableString(headerComponent.publicUrl) ??
            cleanNullableString(headerComponent.mediaUrl) ??
            undefined,
          metaHandle: cleanNullableString(headerComponent.metaHandle) ?? undefined,
          text: cleanNullableString(headerComponent.text) ?? undefined,
        }
      : null,
    languageCode: stringValue(template.languageCode ?? template.language),
    lastSyncedAt: template.lastSyncedAt ?? null,
    metaTemplateId: cleanNullableString(template.metaTemplateId),
    qualityStatus: cleanNullableString(template.qualityStatus ?? template.qualityScore),
    rejectionReason: cleanNullableString(template.rejectionReason),
    status: normalizeEnum(template.status, TEMPLATE_STATUSES, "DRAFT"),
    submittedAt: template.submittedAt ?? template.lastSubmittedAt ?? null,
    templateCategory: normalizeEnum(
      template.templateCategory ?? template.category,
      TEMPLATE_CATEGORIES,
      "UTILITY",
    ),
    templateName: stringValue(template.templateName ?? template.name),
    templateType: readTemplateType(template.components),
    variables:
      Array.isArray(template.variables) && template.variables.length > 0
        ? template.variables
        : serializeTemplateVariables({ body, components }),
  };
}

export function buildMetaTemplateComponents(
  template: WhatsAppTemplateLike,
): WhatsAppTemplateComponent[] {
  const components = readTemplateComponents(template);

  if (components.length > 0) {
    return components.map(cleanMetaComponent);
  }

  return [
    {
      text: stringValue(template.body),
      type: "BODY",
    },
  ];
}

export function buildStoredTemplateComponents({
  body,
  components,
  templateType,
}: {
  body: string;
  components?: unknown;
  templateType: TemplateType;
}) {
  const storedComponents = readTemplateComponents({ body, components });

  if (storedComponents.length > 0 || isRecord(components)) {
    return {
      ...(isRecord(components) ? components : {}),
      components: storedComponents,
      templateType,
    };
  }

  return {
    components: [
      {
        text: body,
        type: "BODY",
      },
    ],
    templateType,
  };
}

export function buildTemplateVariableKeys(template: WhatsAppTemplateLike) {
  return serializeTemplateVariables(template);
}
