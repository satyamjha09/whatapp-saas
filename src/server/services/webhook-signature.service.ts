import crypto from "node:crypto";
import { getRedisConnection } from "@/lib/redis";
import { recordSecurityEvent } from "@/server/services/security-event.service";
import { getRequestIp } from "@/server/utils/request-ip";
import { logger } from "@/server/utils/safe-logger";

export class WebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

export class WebhookReplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookReplayError";
  }
}

type WebhookProvider = "META" | "CASHFREE";

function isVerificationEnabled() {
  return process.env.WEBHOOK_SIGNATURE_VERIFICATION_ENABLED !== "false";
}

function timingSafeEqualString(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function hmacSha256Hex(secret: string, body: string) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

export function verifyMetaWebhookSignature({
  rawBody,
  signatureHeader,
  appSecret,
}: {
  rawBody: string;
  signatureHeader: string | null;
  appSecret: string | undefined;
}) {
  if (!isVerificationEnabled()) {
    return true;
  }

  if (!appSecret) {
    throw new WebhookSignatureError("META_APP_SECRET is not configured");
  }

  if (!signatureHeader) {
    throw new WebhookSignatureError("Missing x-hub-signature-256 header");
  }

  const expected = `sha256=${hmacSha256Hex(appSecret, rawBody)}`;

  if (!timingSafeEqualString(expected, signatureHeader)) {
    throw new WebhookSignatureError("Invalid Meta webhook signature");
  }

  return true;
}

export async function recordWebhookSignatureFailure({
  request,
  provider,
  reason,
}: {
  request: Request;
  provider: WebhookProvider;
  reason: string;
}) {
  await recordSecurityEvent({
    type: "WEBHOOK_SIGNATURE_FAILURE",
    severity: "HIGH",
    source: `${provider.toLowerCase()}-webhook`,
    summary: `${provider} webhook signature verification failed: ${reason}`,
    method: request.method,
    path: new URL(request.url).pathname,
    ipAddress: getRequestIp(request),
    userAgent: request.headers.get("user-agent"),
    metadata: {
      provider,
      reason,
      contentType: request.headers.get("content-type"),
      contentLength: request.headers.get("content-length"),
    },
  }).catch((error) => {
    logger.error("Webhook signature security event recording failed", {
      error,
      provider,
    });
  });
}

function getReplayTtlSeconds() {
  const parsed = Number(process.env.WEBHOOK_REPLAY_TTL_SECONDS ?? 86400);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 86400;
}

export async function detectWebhookReplay({
  provider,
  replayKey,
  request,
}: {
  provider: WebhookProvider;
  replayKey: string | null | undefined;
  request: Request;
}) {
  if (!replayKey) {
    return {
      duplicate: false,
    };
  }

  const redis = getRedisConnection();
  const key = `webhook-replay:${provider}:${replayKey}`;
  const ttl = getReplayTtlSeconds();

  const inserted = await redis.set(key, "1", "EX", ttl, "NX");
  const duplicate = inserted !== "OK";

  if (duplicate) {
    await recordSecurityEvent({
      type: "SUSPICIOUS_REQUEST",
      severity:
        process.env.WEBHOOK_REPLAY_GUARD_MODE === "block" ? "HIGH" : "MEDIUM",
      source: `${provider.toLowerCase()}-webhook`,
      summary: `${provider} webhook replay/duplicate detected`,
      method: request.method,
      path: new URL(request.url).pathname,
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: {
        provider,
        replayKey,
        mode: process.env.WEBHOOK_REPLAY_GUARD_MODE ?? "log",
      },
    });

    if (process.env.WEBHOOK_REPLAY_GUARD_MODE === "block") {
      throw new WebhookReplayError(`${provider} webhook replay blocked`);
    }
  }

  return {
    duplicate,
  };
}

export function getWebhookSignatureHealth() {
  return {
    enabled: isVerificationEnabled(),
    replayGuardMode: process.env.WEBHOOK_REPLAY_GUARD_MODE ?? "log",
    replayTtlSeconds: getReplayTtlSeconds(),
    meta: {
      configured: Boolean(process.env.META_APP_SECRET),
      header: "x-hub-signature-256",
    },
    cashfree: {
      configured: Boolean(process.env.CASHFREE_CLIENT_SECRET),
      header: "x-webhook-signature",
    },
  };
}
