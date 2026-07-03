export type WhatsAppTemplateHeaderType =
  | "NONE"
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "DOCUMENT";

export type WhatsAppTemplateVariable = {
  component: "HEADER" | "BODY" | "BUTTON";
  index: number;
  variableName: string;
  buttonIndex?: number;
  example?: string;
};

export type WhatsAppTemplateComponent = {
  type?: string;
  format?: string;
  text?: string;
  example?: unknown;
  buttons?: unknown[];
  cards?: unknown[];
};

export type WhatsAppTemplateLike = {
  body?: string | null;
  components?: unknown;
  variables?: string[] | null;
};

export type WhatsAppTemplatePreview = {
  headerText?: string;
  bodyText: string;
  footerText?: string;
  buttons: Array<{
    text: string;
    type: string;
    url?: string;
  }>;
  mediaType?: Exclude<WhatsAppTemplateHeaderType, "NONE" | "TEXT">;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function componentType(component: WhatsAppTemplateComponent) {
  return stringValue(component.type).toUpperCase();
}

export function readTemplateComponents(template: WhatsAppTemplateLike) {
  if (Array.isArray(template.components)) {
    return template.components.filter(isRecord) as WhatsAppTemplateComponent[];
  }

  if (
    isRecord(template.components) &&
    Array.isArray(template.components.components)
  ) {
    return template.components.components.filter(
      isRecord,
    ) as WhatsAppTemplateComponent[];
  }

  if (isRecord(template.components)) {
    const record = template.components;
    const components: WhatsAppTemplateComponent[] = [];

    if (typeof record.body === "string") {
      components.push({
        text: record.body,
        type: "BODY",
      });
    }

    return components;
  }

  return [];
}

export function extractVariablesFromText(text?: string | null) {
  const matches = Array.from(
    (text ?? "").matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g),
  );
  const seen = new Set<string>();

  return matches
    .map((match, occurrenceIndex) => {
      const variableName = match[1]?.trim() ?? "";
      if (!variableName || seen.has(variableName)) return null;
      seen.add(variableName);

      const numericIndex = Number(variableName);

      return {
        index: Number.isInteger(numericIndex)
          ? numericIndex
          : occurrenceIndex + 1,
        variableName,
      };
    })
    .filter(
      (item): item is Omit<WhatsAppTemplateVariable, "component"> =>
        Boolean(item),
    )
    .sort((left, right) => left.index - right.index);
}

function readComponentExamples(component: WhatsAppTemplateComponent | undefined) {
  const example = isRecord(component?.example) ? component?.example : {};
  const rawValues =
    (Array.isArray(example.header_text) && example.header_text) ||
    (Array.isArray(example.body_text) && example.body_text[0]) ||
    [];

  return Array.isArray(rawValues) ? rawValues.map((value) => String(value)) : [];
}

function withExamples(
  variables: Array<Omit<WhatsAppTemplateVariable, "component">>,
  examples: string[],
  component: WhatsAppTemplateVariable["component"],
) {
  return variables.map((variable, index) => ({
    ...variable,
    component,
    example: examples[index],
  }));
}

export function getTemplateHeaderType(
  components: WhatsAppTemplateComponent[],
): WhatsAppTemplateHeaderType {
  const header = components.find((component) => componentType(component) === "HEADER");
  const format = stringValue(header?.format).toUpperCase();

  if (["TEXT", "IMAGE", "VIDEO", "DOCUMENT"].includes(format)) {
    return format as WhatsAppTemplateHeaderType;
  }

  return "NONE";
}

export function extractTemplateVariableMetadata(
  template: WhatsAppTemplateLike,
) {
  const components = readTemplateComponents(template);
  const header = components.find((component) => componentType(component) === "HEADER");
  const body = components.find((component) => componentType(component) === "BODY");
  const buttons = components.find(
    (component) => componentType(component) === "BUTTONS",
  );
  const headerType = getTemplateHeaderType(components);
  const variables: WhatsAppTemplateVariable[] = [];

  if (headerType === "TEXT") {
    variables.push(
      ...withExamples(
        extractVariablesFromText(header?.text),
        readComponentExamples(header),
        "HEADER",
      ),
    );
  }

  variables.push(
    ...withExamples(
      extractVariablesFromText(body?.text ?? template.body ?? ""),
      readComponentExamples(body),
      "BODY",
    ),
  );

  if (Array.isArray(buttons?.buttons)) {
    buttons.buttons.forEach((button, buttonIndex) => {
      if (!isRecord(button)) return;

      extractVariablesFromText(stringValue(button.url || button.text)).forEach(
        (variable) => {
          variables.push({
            ...variable,
            buttonIndex,
            component: "BUTTON",
          });
        },
      );
    });
  }

  return {
    headerType,
    mediaRequired: ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType),
    variables,
  };
}

export function serializeTemplateVariables(template: WhatsAppTemplateLike) {
  return extractTemplateVariableMetadata(template).variables.map((variable) => {
    if (variable.component === "BUTTON") {
      return `BUTTON_${variable.buttonIndex ?? 0}_${variable.variableName}`;
    }

    return `${variable.component}_${variable.variableName}`;
  });
}

export function buildTemplatePreview(
  template: WhatsAppTemplateLike,
  sampleValues: Record<string, string> = {},
): WhatsAppTemplatePreview {
  const components = readTemplateComponents(template);
  const header = components.find((component) => componentType(component) === "HEADER");
  const body = components.find((component) => componentType(component) === "BODY");
  const footer = components.find((component) => componentType(component) === "FOOTER");
  const buttonsComponent = components.find(
    (component) => componentType(component) === "BUTTONS",
  );
  const headerType = getTemplateHeaderType(components);
  const replaceVariables = (
    text: string,
    component: WhatsAppTemplateVariable["component"],
    buttonIndex?: number,
  ) =>
    text.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, variableName) => {
      const key = String(variableName).trim();
      return (
        sampleValues[
          buttonIndex === undefined
            ? `${component}_${key}`
            : `${component}_${buttonIndex}_${key}`
        ] ??
        sampleValues[key] ??
        match
      );
    });

  const buttons = Array.isArray(buttonsComponent?.buttons)
    ? buttonsComponent.buttons
        .filter(isRecord)
        .map((button, buttonIndex) => ({
          text: replaceVariables(
            stringValue(button.text || button.title || button.url || "Button"),
            "BUTTON",
            buttonIndex,
          ),
          type: stringValue(button.type || button.sub_type || "QUICK_REPLY"),
          url:
            typeof button.url === "string"
              ? replaceVariables(button.url, "BUTTON", buttonIndex)
              : undefined,
        }))
    : [];

  return {
    bodyText: replaceVariables(
      stringValue(body?.text ?? template.body ?? ""),
      "BODY",
    ),
    buttons,
    footerText: stringValue(footer?.text) || undefined,
    headerText:
      headerType === "TEXT"
        ? replaceVariables(stringValue(header?.text), "HEADER")
        : undefined,
    mediaType:
      headerType === "IMAGE" ||
      headerType === "VIDEO" ||
      headerType === "DOCUMENT"
        ? headerType
        : undefined,
  };
}

export function findTemplateUrls(value: unknown): string[] {
  const urls: string[] = [];

  function visit(current: unknown) {
    if (typeof current === "string") {
      if (/^https?:\/\//i.test(current)) urls.push(current);
      return;
    }

    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }

    if (isRecord(current)) {
      Object.values(current).forEach(visit);
    }
  }

  visit(value);

  return Array.from(new Set(urls));
}

export function hasLocalhostUrl(url: string) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.endsWith(".local")
    );
  } catch {
    return false;
  }
}
