import { NextResponse } from "next/server";
import { UsageQuotaExceededError } from "@/server/services/usage-quota.service";

export function createUsageQuotaErrorResponse(error: unknown) {
  if (error instanceof UsageQuotaExceededError) {
    return NextResponse.json(
      {
        ok: false,
        code: error.code,
        message: error.message,
      },
      {
        status: 402,
      },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      code: "USAGE_QUOTA_ERROR",
      message: "Usage quota check failed",
    },
    {
      status: 402,
    },
  );
}
