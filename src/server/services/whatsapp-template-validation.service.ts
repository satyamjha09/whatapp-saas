import type { Template } from "@/generated/prisma/client";
import {
  ORDER_STATUS_REQUIRED_FIELDS,
  ORDER_STATUS_TEMPLATE_PURPOSES,
  ORDER_STATUS_VARIABLE_SOURCES,
  isAllowedOrderStatusTemplateField,
} from "@/lib/whatsapp-template/order-status-template";
import { canonicalizeTemplateDraft } from "@/lib/whatsapp-template/template-definition";
import { validatePublicMediaUrl } from "@/lib/whatsapp-template/media-url-policy";
import {
  validateCarouselCardButtons,
  validateTemplateButtons,
} from "@/lib/whatsapp-template/template-button-rules";
import { buildVariableMetadata } from "@/lib/whatsapp-template/template-variable-engine";
import {
  extractVariablesFromText,
  extractTemplateVariableMetadata,
  findTemplateUrls,
} from "@/lib/whatsapp-template/template-variable-parser";

export type TemplateValidationIssue = {
  code: string;
  message: string;
  severity: "ERROR" | "WARNING";
};

export type TemplateValidationResult = {
  canSubmit: boolean;
  errors: TemplateValidationIssue[];
  warnings: TemplateValidationIssue[];
};

function issue(
  severity: TemplateValidationIssue["severity"],
  code: string,
  message: string,
): TemplateValidationIssue {
  return {
    code,
    message,
    severity,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function componentType(value: unknown) {
  return isRecord(value) && typeof value.type === "string"
    ? value.type.toUpperCase()
    : "";
}

function storedTemplateType(value: unknown) {
  return isRecord(value) && typeof value.templateType === "string"
    ? value.templateType.toUpperCase()
    : "STANDARD";
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function hasExample(component: unknown) {
  if (!isRecord(component) || !isRecord(component.example)) return false;

  return Object.values(component.example).some((value) => {
    if (!Array.isArray(value)) return false;
    if (value.length === 0) return false;

    const first = value[0];
    return Array.isArray(first) ? first.length > 0 : true;
  });
}

function isProductionLike() {
  return process.env.NODE_ENV === "production";
}

function validateOrderStatusTemplateForSubmission({
  bodyText,
  components,
  templateCategory,
}: {
  bodyText: string;
  components: Record<string, unknown>;
  templateCategory: string;
}) {
  const issues: TemplateValidationIssue[] = [];

  if (templateCategory !== "UTILITY") {
    issues.push(
      issue(
        "ERROR",
        "ORDER_STATUS_CATEGORY_INVALID",
        "Order status templates must use Utility category.",
      ),
    );
  }

  const orderStatus = isRecord(components.orderStatus)
    ? components.orderStatus
    : {};
  const purpose = stringValue(orderStatus.purpose).toUpperCase();
  const validPurpose = ORDER_STATUS_TEMPLATE_PURPOSES.includes(
    purpose as (typeof ORDER_STATUS_TEMPLATE_PURPOSES)[number],
  );

  if (!validPurpose) {
    issues.push(
      issue(
        "ERROR",
        "ORDER_STATUS_PURPOSE_INVALID",
        "Select a supported order status purpose.",
      ),
    );
  }

  const variableMappings = Array.isArray(orderStatus.variableMappings)
    ? orderStatus.variableMappings.filter(isRecord)
    : [];
  const bodyVariables = extractVariablesFromText(bodyText).map(
    (variable) => variable.variableName,
  );
  const bodyVariableSet = new Set(bodyVariables);
  const mappedVariables = new Set(
    variableMappings.map((mapping) => stringValue(mapping.variable)),
  );

  bodyVariables.forEach((variable) => {
    if (!mappedVariables.has(variable)) {
      issues.push(
        issue(
          "ERROR",
          "ORDER_STATUS_MAPPING_MISSING",
          `Mapping is required for {{${variable}}}.`,
        ),
      );
    }
  });

  variableMappings.forEach((mapping) => {
    const variable = stringValue(mapping.variable);
    const source = stringValue(mapping.source).toUpperCase();
    const field = stringValue(mapping.field);
    const sampleValue = stringValue(mapping.sampleValue);

    if (!bodyVariableSet.has(variable)) {
      issues.push(
        issue(
          "ERROR",
          "ORDER_STATUS_MAPPING_UNUSED",
          `Mapping {{${variable}}} does not exist in the body.`,
        ),
      );
    }

    if (
      !ORDER_STATUS_VARIABLE_SOURCES.includes(
        source as (typeof ORDER_STATUS_VARIABLE_SOURCES)[number],
      )
    ) {
      issues.push(
        issue(
          "ERROR",
          "ORDER_STATUS_MAPPING_SOURCE_INVALID",
          "Variable mapping source is not supported.",
        ),
      );
    }

    if (!field || !isAllowedOrderStatusTemplateField(source, field)) {
      issues.push(
        issue(
          "ERROR",
          "ORDER_STATUS_MAPPING_FIELD_INVALID",
          "Variable mapping field is not allowed.",
        ),
      );
    }

    if (!sampleValue) {
      issues.push(
        issue(
          "ERROR",
          "ORDER_STATUS_MAPPING_SAMPLE_MISSING",
          `Sample value is required for {{${variable}}}.`,
        ),
      );
    }
  });

  if (validPurpose) {
    const mappedOrderFields = new Set(
      variableMappings
        .filter(
          (mapping) => stringValue(mapping.source).toUpperCase() === "ORDER_FIELD",
        )
        .map((mapping) => stringValue(mapping.field)),
    );

    ORDER_STATUS_REQUIRED_FIELDS[
      purpose as keyof typeof ORDER_STATUS_REQUIRED_FIELDS
    ].forEach((field) => {
      if (!mappedOrderFields.has(field)) {
        issues.push(
          issue(
            "ERROR",
            "ORDER_STATUS_REQUIRED_FIELD_MISSING",
            `${field} mapping is required for ${purpose}.`,
          ),
        );
      }
    });
  }

  return issues;
}

function validatePublicUrls(
  urls: string[],
  issues: TemplateValidationIssue[],
) {
  for (const url of urls) {
    const result = validatePublicMediaUrl(url);

    if (!result.ok) {
      issues.push(
        issue(
          "ERROR",
          "PUBLIC_URL_BLOCKED",
          `${result.reason ?? "Template URL is not allowed"} (${url})`,
        ),
      );
    }
  }
}

export function validateTemplateForMetaSubmission(
  template: Pick<
    Template,
    | "body"
    | "category"
    | "components"
    | "language"
    | "name"
    | "status"
  >,
): TemplateValidationResult {
  const issues: TemplateValidationIssue[] = [];
  const canonical = canonicalizeTemplateDraft(template);
  const components = canonical.components;
  const body = components.find((component) => componentType(component) === "BODY");
  const header = components.find((component) => componentType(component) === "HEADER");
  const metadata = extractTemplateVariableMetadata(template);
  const variableEngineMetadata = buildVariableMetadata({
    body: canonical.body,
    buttons: canonical.buttons,
    headerText: canonical.header?.format === "TEXT" ? canonical.header.text : "",
  });
  const urls = findTemplateUrls(template.components);
  const templateType = canonical.templateType || storedTemplateType(template.components);
  const storedComponents = isRecord(template.components) ? template.components : {};
  const hasMetaPayload =
    components.length > 0 &&
    !(
      components.length === 1 &&
      componentType(components[0]) === "BODY" &&
      templateType !== "STANDARD"
    );

  if (!/^[a-z0-9_]{2,80}$/.test(canonical.templateName)) {
    issues.push(
      issue(
        "ERROR",
        "NAME_INVALID",
        "Template name must use lowercase letters, numbers, and underscores only.",
      ),
    );
  }

  if (!["MARKETING", "UTILITY", "AUTHENTICATION"].includes(canonical.templateCategory)) {
    issues.push(
      issue("ERROR", "CATEGORY_INVALID", "Template category is not supported."),
    );
  }

  if (!canonical.languageCode.trim()) {
    issues.push(issue("ERROR", "LANGUAGE_MISSING", "Language is required."));
  }

  if (!canonical.body.trim() && !(isRecord(body) && typeof body.text === "string")) {
    issues.push(issue("ERROR", "BODY_MISSING", "Template body is required."));
  }

  variableEngineMetadata.issues
    .filter((item) => item.code === "VARIABLE_SEQUENCE_GAP" || item.code === "VARIABLE_SEQUENCE_START")
    .forEach((item) => {
      issues.push(issue("ERROR", item.code, item.message));
    });

  if (!["STANDARD", "ORDER_STATUS"].includes(templateType) && !hasMetaPayload) {
    issues.push(
      issue(
        "ERROR",
        "META_COMPONENT_PAYLOAD_REQUIRED",
        "Carousel, media, and catalog drafts need a real Meta component payload before submission.",
      ),
    );
  }

  if (templateType === "ORDER_STATUS") {
    issues.push(
      ...validateOrderStatusTemplateForSubmission({
        bodyText: canonical.body,
        components: storedComponents,
        templateCategory: canonical.templateCategory,
      }),
    );
  }

  if (templateType === "CATALOG") {
    if (canonical.templateCategory !== "MARKETING") {
      issues.push(
        issue(
          "ERROR",
          "CATALOG_CATEGORY_INVALID",
          "Catalog templates must use Marketing category.",
        ),
      );
    }

    const catalog = isRecord(storedComponents.catalog)
      ? storedComponents.catalog
      : {};
    const localCatalogId =
      typeof catalog.localCatalogId === "string" ? catalog.localCatalogId.trim() : "";
    const metaCatalogId =
      typeof catalog.metaCatalogId === "string" ? catalog.metaCatalogId.trim() : "";

    if (!localCatalogId) {
      issues.push(
        issue(
          "ERROR",
          "CATALOG_LOCAL_ID_MISSING",
          "Catalog templates must reference a synced workspace Catalog.",
        ),
      );
    }

    if (!metaCatalogId) {
      issues.push(
        issue(
          "ERROR",
          "CATALOG_META_ID_MISSING",
          "Catalog templates need a Meta Catalog ID before submission.",
        ),
      );
    }

    const catalogButtons = canonical.buttons.filter(
      (button) => button.type === "CATALOG",
    );

    if (catalogButtons.length !== 1) {
      issues.push(
        issue(
          "ERROR",
          "CATALOG_BUTTON_REQUIRED",
          "Catalog templates require exactly one View catalog button.",
        ),
      );
    }
  }

  validateTemplateButtons({
    buttons: canonical.buttons,
    templateCategory: canonical.templateCategory,
    templateType,
  }).forEach((item) => {
    issues.push(issue(item.severity, item.code, item.message));
  });

  if (templateType === "CAROUSEL") {
    const cards =
      isRecord(template.components) && Array.isArray(template.components.cards)
        ? template.components.cards
        : [];

    validateCarouselCardButtons(cards).forEach((item) => {
      issues.push(issue(item.severity, item.code, item.message));
    });
  }

  if (metadata.variables.length > 0) {
    const variableComponents = components.filter((component) => {
      const type = componentType(component);

      return type === "HEADER" || type === "BODY";
    });
    const missingExamples = variableComponents.filter((component) => {
      const text = isRecord(component) && typeof component.text === "string"
        ? component.text
        : "";

      return /{{\s*[a-zA-Z0-9_]+\s*}}/.test(text) && !hasExample(component);
    });

    const hasBodyVariables = /{{\s*[a-zA-Z0-9_]+\s*}}/.test(canonical.body);
    const bodyFallbackNeedsExamples =
      components.length === 0 && hasBodyVariables;

    if (missingExamples.length > 0 || bodyFallbackNeedsExamples) {
      issues.push(
        issue(
          "ERROR",
          "VARIABLE_EXAMPLES_MISSING",
          "Template variables require sample values before Meta submission.",
        ),
      );
    }
  }

  validatePublicUrls(urls, issues);

  if (isRecord(header)) {
    const format =
      typeof header.format === "string" ? header.format.toUpperCase() : "";

    if (["IMAGE", "VIDEO", "DOCUMENT"].includes(format)) {
      const mediaAssetId =
        typeof header.mediaAssetId === "string" ? header.mediaAssetId.trim() : "";
      const mediaUrl =
        typeof header.publicUrl === "string"
          ? header.publicUrl
          : typeof header.mediaUrl === "string"
            ? header.mediaUrl
            : "";
      const metaHandle =
        typeof header.metaHandle === "string" ? header.metaHandle.trim() : "";

      if (!mediaAssetId) {
        issues.push(
          issue(
            "ERROR",
            "HEADER_MEDIA_ASSET_REQUIRED",
            "Media headers must use an uploaded reusable media asset.",
          ),
        );
      }

      if (!mediaUrl) {
        issues.push(
          issue(
            "ERROR",
            "HEADER_MEDIA_URL_REQUIRED",
            "Media headers need a public media URL.",
          ),
        );
      } else {
        const mediaUrlPolicy = validatePublicMediaUrl(mediaUrl);

        if (!mediaUrlPolicy.ok) {
          issues.push(
            issue(
              "ERROR",
              "HEADER_MEDIA_URL_BLOCKED",
              mediaUrlPolicy.reason ?? "Header media URL is not allowed.",
            ),
          );
        }
      }

      if (!metaHandle) {
        issues.push(
          issue(
            "ERROR",
            "HEADER_MEDIA_META_HANDLE_REQUIRED",
            "Media headers need a Meta-compatible uploaded sample before submission.",
          ),
        );
      }
    }
  }

  if (!isProductionLike() && urls.length > 0) {
    issues.push(
      issue(
        "WARNING",
        "DEV_LOCAL_URL",
        "Meta approval needs stable public HTTPS URLs.",
      ),
    );
  }

  if (components.length === 0) {
    issues.push(
      issue(
        "WARNING",
        "COMPONENTS_FALLBACK",
        "No Meta component payload is stored; submit will build a simple BODY-only template.",
      ),
    );
  }

  const errors = issues.filter((item) => item.severity === "ERROR");

  return {
    canSubmit: errors.length === 0,
    errors,
    warnings: issues.filter((item) => item.severity === "WARNING"),
  };
}
