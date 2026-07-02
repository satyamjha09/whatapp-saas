export type TemplateHeaderType = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";

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

export type TemplateLike = {
  body?: string | null;
  components?: unknown;
  variables?: string[] | null;
};

type MetaTemplateComponent = {
  type?: string;
  format?: string;
  text?: string;
  example?: unknown;
  buttons?: unknown[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function readTemplateComponents(template: TemplateLike) {
  if (Array.isArray(template.components)) {
    return template.components.filter(isRecord) as MetaTemplateComponent[];
  }

  if (isRecord(template.components) && Array.isArray(template.components.components)) {
    return template.components.components.filter(isRecord) as MetaTemplateComponent[];
  }

  return [];
}

export function extractVariablesFromText(text?: string | null) {
  const source = text ?? "";
  const matches = Array.from(source.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g));
  const seen = new Set<string>();

  return matches
    .map((match, occurrenceIndex) => {
      const variableName = match[1]?.trim() ?? "";
      if (!variableName || seen.has(variableName)) return null;
      seen.add(variableName);

      const numericIndex = Number(variableName);

      return {
        index: Number.isInteger(numericIndex) ? numericIndex : occurrenceIndex + 1,
        variableName,
      };
    })
    .filter((item): item is TemplateVariableMetadataItem => Boolean(item))
    .sort((left, right) => left.index - right.index);
}

function readHeaderType(components: MetaTemplateComponent[]): TemplateHeaderType {
  const header = components.find(
    (component) => stringValue(component.type).toUpperCase() === "HEADER",
  );
  const format = stringValue(header?.format).toUpperCase();

  if (["TEXT", "IMAGE", "VIDEO", "DOCUMENT"].includes(format)) {
    return format as TemplateHeaderType;
  }

  return "NONE";
}

function readComponentExamples(component: MetaTemplateComponent | undefined) {
  const example = isRecord(component?.example) ? component?.example : {};

  const values =
    (Array.isArray(example.header_text) && example.header_text) ||
    (Array.isArray(example.body_text) && example.body_text[0]) ||
    [];

  return Array.isArray(values) ? values.map((value) => String(value)) : [];
}

function withExamples(
  variables: TemplateVariableMetadataItem[],
  examples: string[],
) {
  return variables.map((variable, index) => ({
    ...variable,
    example: examples[index],
  }));
}

export function extractTemplateVariables(
  template: TemplateLike,
): TemplateVariableMetadata {
  const components = readTemplateComponents(template);
  const headerComponent = components.find(
    (component) => stringValue(component.type).toUpperCase() === "HEADER",
  );
  const bodyComponent = components.find(
    (component) => stringValue(component.type).toUpperCase() === "BODY",
  );
  const buttonsComponent = components.find(
    (component) => stringValue(component.type).toUpperCase() === "BUTTONS",
  );
  const headerType = readHeaderType(components);
  const header =
    headerType === "TEXT"
      ? withExamples(
          extractVariablesFromText(headerComponent?.text),
          readComponentExamples(headerComponent),
        )
      : [];
  const body = withExamples(
    extractVariablesFromText(bodyComponent?.text ?? template.body ?? ""),
    readComponentExamples(bodyComponent),
  );
  const buttons: TemplateButtonVariableMetadataItem[] = [];

  if (Array.isArray(buttonsComponent?.buttons)) {
    buttonsComponent.buttons.forEach((button, buttonIndex) => {
      if (!isRecord(button)) return;

      const buttonType = stringValue(button.type || button.sub_type || "URL");
      const variables = extractVariablesFromText(
        stringValue(button.url || button.text),
      );

      variables.forEach((variable) => {
        buttons.push({
          ...variable,
          buttonIndex,
          buttonType,
        });
      });
    });
  }

  return {
    body,
    buttons,
    header,
    headerType,
    mediaRequired: ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType),
  };
}
