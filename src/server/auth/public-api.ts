import { NextResponse } from "next/server";
import { rateLimitByApiKey } from "@/lib/rate-limit";
import { validateApiKey } from "@/server/services/api-key.service";
import { assertAndRecordDeveloperApiUsage } from "@/server/services/developer-api-usage.service";

type PublicApiAuthResult =
  | {
      success: true;
      apiKeyRecord: NonNullable<Awaited<ReturnType<typeof validateApiKey>>>;
    }
  | {
      success: false;
      response: NextResponse;
    };

export async function authenticatePublicApiRequest(
  request: Request,
): Promise<PublicApiAuthResult> {
  const apiKey = request.headers.get("x-api-key");

  if (!apiKey) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, message: "Missing x-api-key header" },
        { status: 401 },
      ),
    };
  }

  const apiKeyRecord = await validateApiKey(apiKey);

  if (!apiKeyRecord) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, message: "Invalid or revoked API key" },
        { status: 401 },
      ),
    };
  }

  try {
    await assertAndRecordDeveloperApiUsage({
      companyId: apiKeyRecord.companyId,
      apiKeyId: apiKeyRecord.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Developer API unavailable";
    const isDailyLimit = message.includes("daily limit");

    return {
      success: false,
      response: NextResponse.json(
        { success: false, message },
        { status: isDailyLimit ? 429 : 403 },
      ),
    };
  }

  const rateLimit = await rateLimitByApiKey(apiKey);

  if (!rateLimit.allowed) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          message: "Rate limit exceeded",
          rateLimit: {
            limit: rateLimit.limit,
            remaining: rateLimit.remaining,
            resetInSeconds: rateLimit.resetInSeconds,
          },
        },
        { status: 429 },
      ),
    };
  }

  return {
    success: true,
    apiKeyRecord,
  };
}
