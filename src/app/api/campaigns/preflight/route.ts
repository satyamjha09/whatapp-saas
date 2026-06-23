import { NextResponse } from "next/server";
import { RATE_LIMIT_RULES } from "@/server/config/rate-limits";
import {
  enforceApiRateLimit,
  isRateLimitResponse,
} from "@/server/utils/api-rate-limit";

export async function POST(request: Request) {
  const rateLimit = await enforceApiRateLimit({
    request,
    rule: RATE_LIMIT_RULES.campaignPreflight,
  });

  if (isRateLimitResponse(rateLimit)) {
    return rateLimit;
  }

  return NextResponse.json({ ok: true });
}
