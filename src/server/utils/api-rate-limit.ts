import { NextResponse } from "next/server";
import type { RateLimitRule } from "@/server/config/rate-limits";
import {
  assertRequestRateLimit,
  RateLimitError,
} from "@/server/services/rate-limit.service";

export async function enforceApiRateLimit({
  request,
  rule,
  identifier,
}: {
  request: Request;
  rule: RateLimitRule;
  identifier?: string;
}) {
  try {
    return await assertRequestRateLimit({
      request,
      rule,
      identifier,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
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

    throw error;
  }
}

export function isRateLimitResponse(
  result: unknown,
): result is NextResponse {
  return result instanceof NextResponse;
}
