import { getRedisConnection } from "@/lib/redis";
import type { RateLimitRule } from "@/server/config/rate-limits";
import { getRequestIp } from "@/server/utils/request-ip";

export class RateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function sanitizeKeyPart(value: string) {
  return value.replaceAll(":", "_").replaceAll("/", "_").slice(0, 120);
}

export async function checkRateLimit({
  rule,
  identifier,
}: {
  rule: RateLimitRule;
  identifier: string;
}) {
  const redis = getRedisConnection();

  const key = `rate-limit:${rule.id}:${sanitizeKeyPart(identifier)}`;

  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, rule.windowSeconds);
  }

  const ttl = await redis.ttl(key);
  const retryAfterSeconds = ttl > 0 ? ttl : rule.windowSeconds;

  const result = {
    key,
    ruleId: rule.id,
    identifier,
    count,
    limit: rule.maxRequests,
    windowSeconds: rule.windowSeconds,
    remaining: Math.max(rule.maxRequests - count, 0),
    retryAfterSeconds,
    allowed: count <= rule.maxRequests,
  };

  if (!result.allowed) {
    throw new RateLimitError(
      `Rate limit exceeded for ${rule.id}`,
      retryAfterSeconds,
    );
  }

  return result;
}

export async function assertRequestRateLimit({
  request,
  rule,
  identifier,
}: {
  request: Request;
  rule: RateLimitRule;
  identifier?: string;
}) {
  const ip = getRequestIp(request);

  return checkRateLimit({
    rule,
    identifier: identifier ?? ip,
  });
}

export function createRateLimitHeaders(result: {
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}) {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "Retry-After": String(result.retryAfterSeconds),
  };
}

export function createRateLimitResponse(error: RateLimitError) {
  return Response.json(
    {
      message: "Too many requests. Please try again later.",
      retryAfterSeconds: error.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(error.retryAfterSeconds),
      },
    },
  );
}
