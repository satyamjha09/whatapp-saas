import { NextResponse } from "next/server";
import { recordSecurityEvent } from "@/server/services/security-event.service";
import { getRequestIp } from "@/server/utils/request-ip";
import { logger } from "@/server/utils/safe-logger";

export class RequestBodyTooLargeError extends Error {
  status = 413;
  maxBytes: number;
  actualBytes?: number;

  constructor({
    maxBytes,
    actualBytes,
  }: {
    maxBytes: number;
    actualBytes?: number;
  }) {
    super(
      actualBytes
        ? `Request body too large. Max ${maxBytes} bytes, received ${actualBytes} bytes.`
        : `Request body too large. Max ${maxBytes} bytes.`,
    );

    this.name = "RequestBodyTooLargeError";
    this.maxBytes = maxBytes;
    this.actualBytes = actualBytes;
  }
}

export class InvalidRequestBodyError extends Error {
  status = 400;

  constructor(message = "Invalid request body") {
    super(message);
    this.name = "InvalidRequestBodyError";
  }
}

function isEnabled() {
  return process.env.REQUEST_BODY_GUARD_ENABLED !== "false";
}

export function bytesFromEnv(name: string, fallback: number) {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : NaN;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const REQUEST_BODY_LIMITS = {
  json: () => bytesFromEnv("MAX_JSON_BODY_BYTES", 1024 * 1024),
  webhook: () => bytesFromEnv("MAX_WEBHOOK_BODY_BYTES", 1024 * 1024),
  cspReport: () => bytesFromEnv("MAX_CSP_REPORT_BODY_BYTES", 64 * 1024),
  bulkMessage: () =>
    bytesFromEnv("MAX_BULK_MESSAGE_BODY_BYTES", 5 * 1024 * 1024),
  contactImport: () =>
    bytesFromEnv("MAX_CONTACT_IMPORT_BODY_BYTES", 5 * 1024 * 1024),
  publicApi: () => bytesFromEnv("MAX_PUBLIC_API_BODY_BYTES", 1024 * 1024),
};

export function assertContentLengthWithinLimit({
  request,
  maxBytes,
}: {
  request: Request;
  maxBytes: number;
}) {
  if (!isEnabled()) return;

  const contentLength = request.headers.get("content-length");

  if (!contentLength) return;

  const actualBytes = Number(contentLength);

  if (Number.isFinite(actualBytes) && actualBytes > maxBytes) {
    throw new RequestBodyTooLargeError({
      maxBytes,
      actualBytes,
    });
  }
}

export async function readRequestTextWithLimit({
  request,
  maxBytes,
}: {
  request: Request;
  maxBytes: number;
}) {
  if (!isEnabled()) {
    return request.text();
  }

  assertContentLengthWithinLimit({
    request,
    maxBytes,
  });

  if (!request.body) {
    return "";
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    if (value) {
      totalBytes += value.byteLength;

      if (totalBytes > maxBytes) {
        throw new RequestBodyTooLargeError({
          maxBytes,
          actualBytes: totalBytes,
        });
      }

      chunks.push(value);
    }
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(merged);
}

export async function readRequestJsonWithLimit<T = unknown>({
  request,
  maxBytes,
}: {
  request: Request;
  maxBytes: number;
}): Promise<T> {
  const text = await readRequestTextWithLimit({
    request,
    maxBytes,
  });

  if (!text.trim()) {
    throw new InvalidRequestBodyError("Request body is empty");
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new InvalidRequestBodyError("Request body must be valid JSON");
  }
}

export async function recordOversizedPayloadSecurityEvent({
  request,
  source,
  maxBytes,
  actualBytes,
}: {
  request: Request;
  source: string;
  maxBytes: number;
  actualBytes?: number;
}) {
  await recordSecurityEvent({
    type: "SUSPICIOUS_REQUEST",
    severity: "MEDIUM",
    source,
    summary: `Oversized request payload blocked. Max ${maxBytes} bytes${
      actualBytes ? `, received ${actualBytes} bytes` : ""
    }.`,
    method: request.method,
    path: new URL(request.url).pathname,
    ipAddress: getRequestIp(request),
    userAgent: request.headers.get("user-agent"),
    metadata: {
      maxBytes,
      actualBytes,
      contentLength: request.headers.get("content-length"),
      contentType: request.headers.get("content-type"),
    },
  }).catch((error) => {
    logger.error("Oversized payload security event recording failed", {
      error,
      source,
    });
  });
}

export async function createRequestBodyErrorResponse({
  request,
  error,
  source,
}: {
  request: Request;
  error: unknown;
  source: string;
}) {
  if (error instanceof RequestBodyTooLargeError) {
    await recordOversizedPayloadSecurityEvent({
      request,
      source,
      maxBytes: error.maxBytes,
      actualBytes: error.actualBytes,
    });

    return NextResponse.json(
      {
        message: "Payload too large",
        maxBytes: error.maxBytes,
      },
      {
        status: 413,
      },
    );
  }

  if (error instanceof InvalidRequestBodyError) {
    return NextResponse.json(
      {
        message: error.message,
      },
      {
        status: 400,
      },
    );
  }

  throw error;
}

export function getRequestBodyGuardSummary() {
  return {
    enabled: isEnabled(),
    limits: {
      json: REQUEST_BODY_LIMITS.json(),
      webhook: REQUEST_BODY_LIMITS.webhook(),
      cspReport: REQUEST_BODY_LIMITS.cspReport(),
      bulkMessage: REQUEST_BODY_LIMITS.bulkMessage(),
      contactImport: REQUEST_BODY_LIMITS.contactImport(),
      publicApi: REQUEST_BODY_LIMITS.publicApi(),
    },
  };
}
