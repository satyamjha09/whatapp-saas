import { Prisma } from "@/generated/prisma/client";

const SECRET_KEY_PATTERN =
  /(authorization|bearer|token|access[_-]?token|refresh[_-]?token|api[_-]?key|secret|password|client[_-]?secret|cashfree|meta[_-]?token|google[_-]?token|webhook[_-]?secret)/i;

const MAX_DEPTH = 5;
const MAX_ARRAY_LENGTH = 30;
const MAX_OBJECT_KEYS = 60;
const MAX_STRING_LENGTH = 500;
const MAX_JSON_LENGTH = 20_000;

function truncateString(value: string) {
  if (value.length <= MAX_STRING_LENGTH) return value;
  return `${value.slice(0, MAX_STRING_LENGTH)}... [truncated]`;
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return "[max_depth]";

  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    return truncateString(value);
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return value;
  }

  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(
      0,
      MAX_OBJECT_KEYS,
    );

    return Object.fromEntries(
      entries.map(([key, item]) => [
        key,
        SECRET_KEY_PATTERN.test(key) ? "[redacted]" : sanitizeValue(item, depth + 1),
      ]),
    );
  }

  return String(value);
}

export function sanitizeAlertMetadata(
  value: unknown,
): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;

  const sanitized = sanitizeValue(value, 0);
  const json = JSON.stringify(sanitized);

  if (json.length <= MAX_JSON_LENGTH) {
    return sanitized as Prisma.InputJsonValue;
  }

  return {
    truncated: true,
    summary: json.slice(0, MAX_JSON_LENGTH),
  };
}
