const SECRET_KEY_PATTERN =
  /(authorization|api[-_ ]?key|token|password|secret|bearer|access[-_ ]?token|client[-_ ]?secret|cashfree|meta[-_ ]?access|google[-_ ]?access)/i;

const MAX_DEPTH = 6;
const MAX_ARRAY_ITEMS = 40;
const MAX_OBJECT_KEYS = 80;
const MAX_STRING_LENGTH = 1200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function truncateString(value: string) {
  if (value.length <= MAX_STRING_LENGTH) return value;

  return `${value.slice(0, MAX_STRING_LENGTH)}... [truncated]`;
}

function shouldRedactKey(key: string) {
  return SECRET_KEY_PATTERN.test(key);
}

function sanitizeHeaderLikeObject(value: Record<string, unknown>) {
  const key = typeof value.key === "string" ? value.key : "";
  const secret = value.secret === true || shouldRedactKey(key);

  if (!("value" in value) || !secret) return null;

  return {
    ...value,
    value: "[redacted]",
  };
}

export function maskAutomationPhoneNumber(value: string | null | undefined) {
  if (!value) return value;

  const digits = value.replace(/\D/g, "");
  if (digits.length <= 4) return "****";

  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

export function sanitizeAutomationLogValue(
  value: unknown,
  depth = 0,
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return truncateString(value);

  if (depth >= MAX_DEPTH) {
    return "[truncated: max depth]";
  }

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeAutomationLogValue(item, depth + 1));

    if (value.length > MAX_ARRAY_ITEMS) {
      items.push(`[truncated: ${value.length - MAX_ARRAY_ITEMS} more items]`);
    }

    return items;
  }

  if (!isRecord(value)) return "[unsupported]";

  const sanitizedHeader = sanitizeHeaderLikeObject(value);
  if (sanitizedHeader) {
    return sanitizedHeader;
  }

  const entries = Object.entries(value);
  const result: Record<string, unknown> = {};

  entries.slice(0, MAX_OBJECT_KEYS).forEach(([key, entryValue]) => {
    if (shouldRedactKey(key)) {
      result[key] = "[redacted]";
      return;
    }

    result[key] = sanitizeAutomationLogValue(entryValue, depth + 1);
  });

  if (entries.length > MAX_OBJECT_KEYS) {
    result.__truncated = `${entries.length - MAX_OBJECT_KEYS} more keys`;
  }

  return result;
}
