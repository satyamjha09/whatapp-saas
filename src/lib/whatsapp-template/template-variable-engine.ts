export type TemplateVariableComponent = "HEADER" | "BODY" | "BUTTON";

export type TemplateVariable = {
  component: TemplateVariableComponent;
  key: string;
  token: string;
  index: number;
  numeric: boolean;
  buttonIndex?: number;
};

export type TemplateVariableIssue = {
  code:
    | "VARIABLE_SEQUENCE_GAP"
    | "VARIABLE_SEQUENCE_START"
    | "VARIABLE_SAMPLE_MISSING"
    | "VARIABLE_UNRESOLVED";
  message: string;
  key?: string;
};

export type TemplateVariableMetadata = {
  variables: TemplateVariable[];
  sampleValues: Record<string, string>;
  issues: TemplateVariableIssue[];
};

const VARIABLE_PATTERN = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeKey(value: string) {
  return value.trim();
}

function variableLookupKeys(variable: TemplateVariable) {
  const namespaced =
    variable.component === "BUTTON"
      ? `BUTTON_${variable.buttonIndex ?? 0}_${variable.key}`
      : `${variable.component}_${variable.key}`;

  return [
    namespaced,
    namespaced.toUpperCase(),
    namespaced.toLowerCase(),
    variable.key,
    variable.key.toUpperCase(),
    variable.key.toLowerCase(),
    variable.token,
  ];
}

export function extractVariables(
  text: string | null | undefined,
  options: {
    buttonIndex?: number;
    component?: TemplateVariableComponent;
  } = {},
): TemplateVariable[] {
  const component = options.component ?? "BODY";
  const seen = new Set<string>();
  const variables: TemplateVariable[] = [];
  let occurrenceIndex = 0;

  for (const match of Array.from((text ?? "").matchAll(VARIABLE_PATTERN))) {
    occurrenceIndex += 1;
    const key = normalizeKey(match[1] ?? "");
    if (!key) continue;

    const dedupeKey = `${component}:${options.buttonIndex ?? ""}:${key}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const numericIndex = Number(key);
    const numeric = Number.isInteger(numericIndex) && numericIndex > 0;

    variables.push({
      buttonIndex: options.buttonIndex,
      component,
      index: numeric ? numericIndex : occurrenceIndex,
      key,
      numeric,
      token: `{{${key}}}`,
    });
  }

  return variables.sort((left, right) => {
    if (left.component !== right.component) {
      return left.component.localeCompare(right.component);
    }

    if ((left.buttonIndex ?? -1) !== (right.buttonIndex ?? -1)) {
      return (left.buttonIndex ?? -1) - (right.buttonIndex ?? -1);
    }

    return left.index - right.index;
  });
}

export function validateVariableSequence(
  variables: TemplateVariable[],
): TemplateVariableIssue[] {
  const issues: TemplateVariableIssue[] = [];
  const groups = new Map<string, TemplateVariable[]>();

  variables
    .filter((variable) => variable.numeric)
    .forEach((variable) => {
      const key = `${variable.component}:${variable.buttonIndex ?? ""}`;
      groups.set(key, [...(groups.get(key) ?? []), variable]);
    });

  groups.forEach((group) => {
    const numericVariables = group.sort((left, right) => left.index - right.index);
    const first = numericVariables[0];

    if (first && first.index !== 1) {
      issues.push({
        code: "VARIABLE_SEQUENCE_START",
        key: first.key,
        message: `${first.component} numeric variables must start at {{1}}.`,
      });
    }

    numericVariables.forEach((variable, index) => {
      const expected = index + 1;

      if (variable.index !== expected) {
        issues.push({
          code: "VARIABLE_SEQUENCE_GAP",
          key: variable.key,
          message: `${variable.component} numeric variable sequence is missing {{${expected}}}.`,
        });
      }
    });
  });

  return issues;
}

export function getSampleValue(
  variable: TemplateVariable,
  sampleValues: Record<string, string>,
) {
  for (const key of variableLookupKeys(variable)) {
    const value = sampleValues[key];
    if (typeof value === "string" && value.trim()) return value;
  }

  return "";
}

export function validateSampleValues(
  variables: TemplateVariable[],
  sampleValues: Record<string, string>,
): TemplateVariableIssue[] {
  return variables
    .filter((variable) => !getSampleValue(variable, sampleValues))
    .map((variable) => ({
      code: "VARIABLE_SAMPLE_MISSING" as const,
      key: variable.key,
      message: `Sample value is required for ${variable.token}.`,
    }));
}

export function renderPreview(
  text: string | null | undefined,
  sampleValues: Record<string, string> = {},
  options: {
    buttonIndex?: number;
    component?: TemplateVariableComponent;
  } = {},
) {
  const component = options.component ?? "BODY";

  return (text ?? "").replace(VARIABLE_PATTERN, (token, key: string) => {
    const variable: TemplateVariable = {
      buttonIndex: options.buttonIndex,
      component,
      index: Number(key),
      key: normalizeKey(key),
      numeric: Number.isInteger(Number(key)) && Number(key) > 0,
      token,
    };
    const sample = getSampleValue(variable, sampleValues);

    return sample || token;
  });
}

export function buildMetaExamples(
  variables: TemplateVariable[],
  sampleValues: Record<string, string>,
  component: TemplateVariableComponent,
): Record<string, unknown> | undefined {
  const componentVariables = variables.filter(
    (variable) => variable.component === component,
  );
  if (componentVariables.length === 0) return undefined;

  const values = componentVariables.map((variable) =>
    getSampleValue(variable, sampleValues),
  );

  if (values.some((value) => !value.trim())) return undefined;

  if (component === "HEADER") {
    return { header_text: values };
  }

  if (component === "BODY") {
    return { body_text: [values] };
  }

  return undefined;
}

export function buildVariableMetadata(input: {
  body?: string | null;
  buttons?: Array<{ text?: string | null; url?: string | null }>;
  headerText?: string | null;
  sampleValues?: Record<string, string>;
}): TemplateVariableMetadata {
  const variables = [
    ...extractVariables(input.headerText, { component: "HEADER" }),
    ...extractVariables(input.body, { component: "BODY" }),
    ...(input.buttons ?? []).flatMap((button, buttonIndex) => [
      ...extractVariables(button.text, { buttonIndex, component: "BUTTON" }),
      ...extractVariables(button.url, { buttonIndex, component: "BUTTON" }),
    ]),
  ];
  const sampleValues = input.sampleValues ?? {};

  return {
    issues: [
      ...validateVariableSequence(variables),
      ...validateSampleValues(variables, sampleValues),
    ],
    sampleValues,
    variables,
  };
}

export function resolveCampaignVariables(
  templateVariables: string[],
  values: Record<string, unknown>,
) {
  const getValue = (key: string) =>
    values[key] ?? values[key.toUpperCase()] ?? values[key.toLowerCase()];

  return templateVariables.map((variable) => {
    const value =
      getValue(variable) ??
      getValue(variable.replace(/^(BODY_|HEADER_)/, "")) ??
      getValue(variable.replace(/^(body_|header_)/, ""));
    return value === null || value === undefined ? "" : String(value);
  });
}

export function resolveAutomationVariables(
  templateVariables: string[],
  values: Map<string, string> | Record<string, unknown>,
) {
  const getValue = (key: string) => {
    if (values instanceof Map) {
      return values.get(key) ?? values.get(key.toUpperCase()) ?? values.get(key.toLowerCase());
    }
    if (!isRecord(values)) return undefined;
    return values[key] ?? values[key.toUpperCase()] ?? values[key.toLowerCase()];
  };

  return templateVariables.map((variable) => {
    const value =
      getValue(variable) ??
      getValue(variable.replace(/^(BODY_|HEADER_)/, "")) ??
      getValue(variable.replace(/^(body_|header_)/, "")) ??
      "";

    return String(value);
  });
}

export function assertNoUnresolvedVariables(rendered: string) {
  const unresolved = extractVariables(rendered);

  if (unresolved.length > 0) {
    return unresolved.map((variable) => ({
      code: "VARIABLE_UNRESOLVED" as const,
      key: variable.key,
      message: `${variable.token} is not resolved.`,
    }));
  }

  return [];
}
