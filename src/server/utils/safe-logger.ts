type LogLevel = "debug" | "info" | "warn" | "error";

type LogPayload = Record<string, unknown>;

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SENSITIVE_KEYWORDS = [
  "token",
  "secret",
  "password",
  "authorization",
  "cookie",
  "apikey",
  "api_key",
  "accesskey",
  "access_key",
  "private",
  "signature",
  "webhook_secret",
  "cashfree_client_secret",
  "meta_app_secret",
  "encryption_key",
];

function getConfiguredLogLevel(): LogLevel {
  const value = process.env.APP_LOG_LEVEL;

  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }

  return "info";
}

function shouldLog(level: LogLevel) {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[getConfiguredLogLevel()];
}

function isRedactionEnabled() {
  return process.env.APP_LOG_REDACTION_ENABLED !== "false";
}

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase().replaceAll("-", "_");

  return SENSITIVE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function redactString(value: string) {
  if (!isRedactionEnabled()) {
    return value;
  }

  if (value.length <= 8) {
    return "[REDACTED]";
  }

  return `${value.slice(0, 4)}...[REDACTED]...${value.slice(-4)}`;
}

export function redactSensitiveData(value: unknown, depth = 0): unknown {
  if (!isRedactionEnabled()) {
    return value;
  }

  if (depth > 6) {
    return "[MAX_DEPTH]";
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: process.env.NODE_ENV === "production" ? undefined : value.stack,
    };
  }

  if (typeof value === "string") {
    const looksLikeSecret =
      value.startsWith("Bearer ") ||
      value.startsWith("sk_") ||
      value.startsWith("pk_") ||
      value.length > 80;

    return looksLikeSecret ? redactString(value) : value;
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item, depth + 1));
  }

  const record = value as Record<string, unknown>;
  const redacted: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(record)) {
    if (isSensitiveKey(key)) {
      redacted[key] = "[REDACTED]";
      continue;
    }

    redacted[key] = redactSensitiveData(item, depth + 1);
  }

  return redacted;
}

function formatPayload(payload?: LogPayload) {
  if (!payload) {
    return {};
  }

  return redactSensitiveData(payload) as LogPayload;
}

function writeLog(level: LogLevel, message: string, payload?: LogPayload) {
  if (!shouldLog(level)) {
    return;
  }

  const formattedPayload = formatPayload(payload);

  const logEntry = {
    level,
    message,
    time: new Date().toISOString(),
    ...formattedPayload,
  };

  if (process.env.APP_LOG_FORMAT === "json") {
    const line = JSON.stringify(logEntry);

    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }

    return;
  }

  const prefix = `[${logEntry.time}] ${level.toUpperCase()} ${message}`;

  if (Object.keys(formattedPayload).length === 0) {
    if (level === "error") console.error(prefix);
    else if (level === "warn") console.warn(prefix);
    else console.log(prefix);

    return;
  }

  if (level === "error") console.error(prefix, formattedPayload);
  else if (level === "warn") console.warn(prefix, formattedPayload);
  else console.log(prefix, formattedPayload);
}

export const logger = {
  debug(message: string, payload?: LogPayload) {
    writeLog("debug", message, payload);
  },

  info(message: string, payload?: LogPayload) {
    writeLog("info", message, payload);
  },

  warn(message: string, payload?: LogPayload) {
    writeLog("warn", message, payload);
  },

  error(message: string, payload?: LogPayload) {
    writeLog("error", message, payload);
  },
};

export function getSafeLoggerSummary() {
  return {
    level: getConfiguredLogLevel(),
    format: process.env.APP_LOG_FORMAT === "json" ? "json" : "pretty",
    redactionEnabled: isRedactionEnabled(),
    requestIdHeader: process.env.APP_REQUEST_ID_HEADER ?? "x-request-id",
    sensitiveKeywordCount: SENSITIVE_KEYWORDS.length,
  };
}
