import crypto from "crypto";
import { redisConnection } from "@/lib/redis";

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetInSeconds: number;
};

function hashValue(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function rateLimitByApiKey(
  apiKey: string,
  limit = 60,
  windowSeconds = 60,
): Promise<RateLimitResult> {
  const apiKeyHash = hashValue(apiKey);
  const redisKey = `rate-limit:api-key:${apiKeyHash}`;

  const current = await redisConnection.incr(redisKey);

  if (current === 1) {
    await redisConnection.expire(redisKey, windowSeconds);
  }

  const ttl = await redisConnection.ttl(redisKey);
  const remaining = Math.max(limit - current, 0);

  return {
    allowed: current <= limit,
    limit,
    remaining,
    resetInSeconds: ttl > 0 ? ttl : windowSeconds,
  };
}
