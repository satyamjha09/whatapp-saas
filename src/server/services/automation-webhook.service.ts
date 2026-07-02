import type { ApiHeader } from "@/lib/automation-builder/types";

const MAX_WEBHOOK_RESPONSE_BYTES = 128 * 1024;

function isPrivateOrLocalUrl(url: string) {
  const hostname = new URL(url).hostname.toLowerCase();
  const parts = hostname.split(".").map((part) => Number(part));

  if (
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".localhost")
  ) {
    return true;
  }

  if (parts.length === 4 && parts.every((part) => Number.isInteger(part))) {
    const [first, second] = parts;
    return (
      first === 10 ||
      first === 127 ||
      first === 0 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }

  return false;
}

function parseWebhookUrl(url: string) {
  const parsed = new URL(url);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Webhook URL must use HTTP or HTTPS");
  }

  if (isPrivateOrLocalUrl(url)) {
    throw new Error("Webhook URL cannot target localhost or private networks");
  }

  return parsed;
}

function buildHeaders(headers: ApiHeader[]) {
  const result = new Headers();

  headers.forEach((header) => {
    const key = header.key.trim();
    const value = header.value.trim();

    if (!key || !value || header.secret) return;
    result.set(key, value);
  });

  if (!result.has("content-type")) {
    result.set("content-type", "application/json");
  }

  return result;
}

function parseResponseBody(text: string) {
  if (!text.trim()) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function executeAutomationWebhook({
  body,
  headers,
  method,
  timeoutMs,
  url,
}: {
  body?: string;
  headers: ApiHeader[];
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  timeoutMs: number;
  url: string;
}) {
  parseWebhookUrl(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      body: method === "GET" ? undefined : body,
      headers: buildHeaders(headers),
      method,
      signal: controller.signal,
    });

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_WEBHOOK_RESPONSE_BYTES) {
      throw new Error("Webhook response is too large");
    }

    const text = await response.text();
    if (new TextEncoder().encode(text).length > MAX_WEBHOOK_RESPONSE_BYTES) {
      throw new Error("Webhook response is too large");
    }

    return {
      body: parseResponseBody(text),
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
    };
  } finally {
    clearTimeout(timeout);
  }
}
