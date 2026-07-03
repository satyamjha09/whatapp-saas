import type { Template } from "@/generated/prisma/client";
import {
  extractTemplateVariableMetadata,
  findTemplateUrls,
  hasLocalhostUrl,
  readTemplateComponents,
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

function hasMetaComponentArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.some((component) => Boolean(componentType(component)));
  }

  if (isRecord(value) && Array.isArray(value.components)) {
    return value.components.some((component) => Boolean(componentType(component)));
  }

  return false;
}

function storedTemplateType(value: unknown) {
  return isRecord(value) && typeof value.templateType === "string"
    ? value.templateType.toUpperCase()
    : "STANDARD";
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

function validatePublicUrls(
  urls: string[],
  issues: TemplateValidationIssue[],
) {
  for (const url of urls) {
    try {
      const parsed = new URL(url);

      if (parsed.protocol !== "https:") {
        issues.push(
          issue(
            "ERROR",
            "PUBLIC_URL_HTTPS_REQUIRED",
            `Template URL must use HTTPS: ${url}`,
          ),
        );
      }

      if (hasLocalhostUrl(url)) {
        issues.push(
          issue(
            "ERROR",
            "PUBLIC_URL_LOCALHOST",
            `Template URL cannot point to localhost: ${url}`,
          ),
        );
      }
    } catch {
      issues.push(
        issue("ERROR", "PUBLIC_URL_INVALID", `Template URL is invalid: ${url}`),
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
  const components = readTemplateComponents(template);
  const body = components.find((component) => componentType(component) === "BODY");
  const metadata = extractTemplateVariableMetadata(template);
  const urls = findTemplateUrls(template.components);
  const templateType = storedTemplateType(template.components);
  const hasMetaPayload = hasMetaComponentArray(template.components);

  if (!/^[a-z0-9_]{2,80}$/.test(template.name)) {
    issues.push(
      issue(
        "ERROR",
        "NAME_INVALID",
        "Template name must use lowercase letters, numbers, and underscores only.",
      ),
    );
  }

  if (!["MARKETING", "UTILITY", "AUTHENTICATION"].includes(template.category)) {
    issues.push(
      issue("ERROR", "CATEGORY_INVALID", "Template category is not supported."),
    );
  }

  if (!template.language.trim()) {
    issues.push(issue("ERROR", "LANGUAGE_MISSING", "Language is required."));
  }

  if (!template.body.trim() && !(isRecord(body) && typeof body.text === "string")) {
    issues.push(issue("ERROR", "BODY_MISSING", "Template body is required."));
  }

  if (templateType !== "STANDARD" && !hasMetaPayload) {
    issues.push(
      issue(
        "ERROR",
        "META_COMPONENT_PAYLOAD_REQUIRED",
        "Carousel, media, and catalog drafts need a real Meta component payload before submission.",
      ),
    );
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

    const hasBodyVariables = /{{\s*[a-zA-Z0-9_]+\s*}}/.test(template.body);
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

  if (!isProductionLike() && urls.some(hasLocalhostUrl)) {
    issues.push(
      issue(
        "WARNING",
        "DEV_LOCAL_URL",
        "Local URLs are useful for testing, but Meta approval needs public HTTPS URLs.",
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
