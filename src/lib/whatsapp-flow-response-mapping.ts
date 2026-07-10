export const FLOW_RESPONSE_CONTACT_FIELD_TARGETS = [
  "name",
  "email",
  "companyName",
  "city",
  "lifecycleStage",
] as const;

export const FLOW_RESPONSE_TRANSFORMS = [
  "NONE",
  "TRIM",
  "LOWERCASE",
  "UPPERCASE",
  "NUMBER",
  "BOOLEAN",
  "DATE_ISO",
] as const;

export const FLOW_RESPONSE_CONFLICT_POLICIES = [
  "OVERWRITE",
  "OVERWRITE_IF_EMPTY",
  "KEEP_EXISTING",
] as const;

export const FLOW_RESPONSE_TARGET_TYPES = [
  "CONTACT_FIELD",
  "CUSTOM_FIELD",
] as const;

export type FlowResponseContactFieldTarget =
  (typeof FLOW_RESPONSE_CONTACT_FIELD_TARGETS)[number];
export type FlowResponseTransform = (typeof FLOW_RESPONSE_TRANSFORMS)[number];
export type FlowResponseConflictPolicy =
  (typeof FLOW_RESPONSE_CONFLICT_POLICIES)[number];
export type FlowResponseTargetType = (typeof FLOW_RESPONSE_TARGET_TYPES)[number];

export type FlowResponseMapping = {
  id?: string;
  sourcePath: string;
  targetType: FlowResponseTargetType;
  targetKey: string;
  transform: FlowResponseTransform;
  conflictPolicy: FlowResponseConflictPolicy;
};

export type FlowResponseMappingIssue = {
  index: number;
  message: string;
};

const BLOCKED_PATH_PARTS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_MAPPINGS = 50;
const MAX_PATH_PARTS = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTransform(value: unknown): FlowResponseTransform {
  const normalized = normalizeString(value).toUpperCase();
  return FLOW_RESPONSE_TRANSFORMS.includes(normalized as FlowResponseTransform)
    ? (normalized as FlowResponseTransform)
    : "NONE";
}

function normalizeConflictPolicy(value: unknown): FlowResponseConflictPolicy {
  const normalized = normalizeString(value).toUpperCase();
  return FLOW_RESPONSE_CONFLICT_POLICIES.includes(
    normalized as FlowResponseConflictPolicy,
  )
    ? (normalized as FlowResponseConflictPolicy)
    : "OVERWRITE";
}

function normalizeTargetType(value: unknown): FlowResponseTargetType {
  const normalized = normalizeString(value).toUpperCase();
  return FLOW_RESPONSE_TARGET_TYPES.includes(normalized as FlowResponseTargetType)
    ? (normalized as FlowResponseTargetType)
    : "CUSTOM_FIELD";
}

export function normalizeFlowResponseMappings(value: unknown): FlowResponseMapping[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, MAX_MAPPINGS).map((item) => {
    const mapping = isRecord(item) ? item : {};

    return {
      conflictPolicy: normalizeConflictPolicy(mapping.conflictPolicy),
      id: normalizeString(mapping.id) || undefined,
      sourcePath: normalizeString(mapping.sourcePath),
      targetKey: normalizeString(mapping.targetKey),
      targetType: normalizeTargetType(mapping.targetType),
      transform: normalizeTransform(mapping.transform),
    };
  });
}

export function readFlowResponseMappingsFromComponents(components: unknown) {
  if (!isRecord(components)) return [];
  return normalizeFlowResponseMappings(components.responseMappings);
}

export function isSafeFlowResponsePath(path: string) {
  if (!path || path.length > 240) return false;
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0 || parts.length > MAX_PATH_PARTS) return false;

  return parts.every((part) => {
    if (BLOCKED_PATH_PARTS.has(part)) return false;
    return /^[A-Za-z0-9_-]{1,80}$/.test(part);
  });
}

export function isSafeCustomFieldKey(key: string) {
  return /^[A-Za-z0-9_.-]{1,80}$/.test(key) && !BLOCKED_PATH_PARTS.has(key);
}

export function validateFlowResponseMappings(
  mappings: FlowResponseMapping[],
): FlowResponseMappingIssue[] {
  const issues: FlowResponseMappingIssue[] = [];
  const targets = new Set<string>();

  mappings.forEach((mapping, index) => {
    if (!isSafeFlowResponsePath(mapping.sourcePath)) {
      issues.push({
        index,
        message: "Source path is invalid or unsafe.",
      });
    }

    if (mapping.targetType === "CONTACT_FIELD") {
      if (
        !FLOW_RESPONSE_CONTACT_FIELD_TARGETS.includes(
          mapping.targetKey as FlowResponseContactFieldTarget,
        )
      ) {
        issues.push({
          index,
          message: "Contact field target is not allowed.",
        });
      }
    } else if (!isSafeCustomFieldKey(mapping.targetKey)) {
      issues.push({
        index,
        message: "Custom field key is invalid or unsafe.",
      });
    }

    const targetId = `${mapping.targetType}:${mapping.targetKey}`;
    if (targets.has(targetId)) {
      issues.push({
        index,
        message: "Two mappings cannot write to the same target.",
      });
    }
    targets.add(targetId);
  });

  return issues;
}

export function resolveFlowResponseValue(
  responseData: unknown,
  sourcePath: string,
) {
  if (!isSafeFlowResponsePath(sourcePath)) return undefined;

  const parts = sourcePath.split(".").filter(Boolean);
  let value: unknown = responseData;

  for (const part of parts) {
    if (Array.isArray(value)) {
      if (!/^\d+$/.test(part)) return undefined;
      value = value[Number(part)];
      continue;
    }

    if (!isRecord(value)) return undefined;
    value = value[part];
  }

  return value;
}

export function transformFlowResponseValue(
  value: unknown,
  transform: FlowResponseTransform,
) {
  if (value === undefined || value === null) return undefined;

  if (transform === "NUMBER") {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : undefined;
  }

  if (transform === "BOOLEAN") {
    if (typeof value === "boolean") return value;
    const text = String(value).trim().toLowerCase();
    if (["true", "yes", "1", "y"].includes(text)) return true;
    if (["false", "no", "0", "n"].includes(text)) return false;
    return undefined;
  }

  if (transform === "DATE_ISO") {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  const text = typeof value === "object" ? JSON.stringify(value) : String(value);

  if (transform === "TRIM") return text.trim();
  if (transform === "LOWERCASE") return text.trim().toLowerCase();
  if (transform === "UPPERCASE") return text.trim().toUpperCase();

  return text;
}

export function isEmptyFlowMappingValue(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}
