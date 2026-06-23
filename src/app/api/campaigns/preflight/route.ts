import { NextResponse } from "next/server";
import { RATE_LIMIT_RULES } from "@/server/config/rate-limits";
import {
  enforceApiRateLimit,
  isRateLimitResponse,
} from "@/server/utils/api-rate-limit";
import {
  createRequestBodyErrorResponse,
  readRequestJsonWithLimit,
  REQUEST_BODY_LIMITS,
} from "@/server/utils/request-body-guard";

export async function POST(request: Request) {
  const rateLimit = await enforceApiRateLimit({
    request,
    rule: RATE_LIMIT_RULES.campaignPreflight,
  });

  if (isRateLimitResponse(rateLimit)) {
    return rateLimit;
  }

  try {
    await readRequestJsonWithLimit({
      request,
      maxBytes: REQUEST_BODY_LIMITS.bulkMessage(),
    });
  } catch (error) {
    return createRequestBodyErrorResponse({
      request,
      error,
      source: "campaign-preflight",
    });
  }

  return NextResponse.json({ ok: true });
}
