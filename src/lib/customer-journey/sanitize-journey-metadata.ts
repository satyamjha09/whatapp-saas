const SENSITIVE_KEY_PATTERNS = [
  /api[-_]?key/i,
  /access[-_]?token/i,
  /secret/i,
  /password/i,
  /auth(orization)?/i,
  /meta[-_]?token/i,
  /cashfree[-_]?secret/i,
  /google[-_]?token/i,
  /private[-_]?key/i,
  /bearer/i,
  /signature/i,
];

export function sanitizeJourneyMetadata(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (depth > 5) {
    return "[Truncated Depth]";
  }

  if (typeof value === "string") {
    // Check if string looks like an authorization header or raw token
    if (value.startsWith("Bearer ") || value.startsWith("Basic ")) {
      return "[Redacted Token]";
    }
    // Truncate excessively long payload strings to max 500 chars
    if (value.length > 500) {
      return value.slice(0, 500) + "... [Truncated]";
    }
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJourneyMetadata(item, depth + 1));
  }

  if (typeof value === "object") {
    const sanitizedObj: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));

      if (isSensitiveKey) {
        sanitizedObj[key] = "[Redacted]";
      } else {
        sanitizedObj[key] = sanitizeJourneyMetadata(val, depth + 1);
      }
    }

    return sanitizedObj;
  }

  return String(value);
}
