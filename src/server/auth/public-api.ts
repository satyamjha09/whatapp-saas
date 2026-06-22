import { NextResponse } from "next/server";
import { rateLimitByApiKey } from "@/lib/rate-limit";
import type { DeveloperApiScope } from "@/server/config/developer-api-scopes";
import {
  markApiKeyLastUsed,
  validateApiKey,
} from "@/server/services/api-key.service";
import { assertAndRecordDeveloperApiUsage } from "@/server/services/developer-api-usage.service";
import { logDeveloperApiRequest } from "@/server/services/developer-api-request-log.service";
import { assertDeveloperApiScope } from "@/server/services/developer-api-scope.service";
import { isIpAllowed } from "@/server/utils/ip-allowlist";
import { getRequestIp } from "@/server/utils/request-ip";

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

  let apiKeyRecord: Awaited<ReturnType<typeof validateApiKey>>;

  try {
    apiKeyRecord = await validateApiKey(apiKey);
  } catch (error) {
    if (
      error instanceof Error &&
      ["API key has been revoked", "API key has expired"].includes(
        error.message,
      )
    ) {
      return {
        success: false,
        response: NextResponse.json(
          { success: false, message: error.message },
          { status: 403 },
        ),
      };
    }

    throw error;
  }

  if (!apiKeyRecord) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, message: "Invalid or revoked API key" },
        { status: 401 },
      ),
    };
  }

  const requestIp = getRequestIp(request);

  if (
    !isIpAllowed({
      requestIp,
      allowedIps: apiKeyRecord.allowedIps,
    })
  ) {
    const message = "API key is not allowed from this IP address";

    await safeLogDeveloperApiRequest({
      companyId: apiKeyRecord.companyId,
      apiKeyId: apiKeyRecord.id,
      request,
      status: "BLOCKED",
      statusCode: 403,
      errorMessage: message,
    });

    return {
      success: false,
      response: NextResponse.json(
        { success: false, message },
        { status: 403 },
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
    await safeLogDeveloperApiRequest({
      companyId: apiKeyRecord.companyId,
      apiKeyId: apiKeyRecord.id,
      request,
      status: isDailyLimit ? "RATE_LIMITED" : "BLOCKED",
      statusCode: isDailyLimit ? 429 : 403,
      errorMessage: message,
    });

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
    await safeLogDeveloperApiRequest({
      companyId: apiKeyRecord.companyId,
      apiKeyId: apiKeyRecord.id,
      request,
      status: "RATE_LIMITED",
      statusCode: 429,
      errorMessage: "Rate limit exceeded",
    });

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

  await safeLogDeveloperApiRequest({
    companyId: apiKeyRecord.companyId,
    apiKeyId: apiKeyRecord.id,
    request,
    status: "SUCCESS",
    statusCode: 200,
  });
  await markApiKeyLastUsed(apiKeyRecord.id);

  return {
    success: true,
    apiKeyRecord,
  };
}

export async function requirePublicApiScope({
  request,
  apiKeyRecord,
  requiredScope,
}: {
  request: Request;
  apiKeyRecord: NonNullable<Awaited<ReturnType<typeof validateApiKey>>>;
  requiredScope: DeveloperApiScope;
}) {
  try {
    assertDeveloperApiScope({
      scopes: apiKeyRecord.scopes,
      requiredScope,
    });

    return null;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : `API key is missing required scope: ${requiredScope}`;

    await safeLogDeveloperApiRequest({
      companyId: apiKeyRecord.companyId,
      apiKeyId: apiKeyRecord.id,
      request,
      status: "BLOCKED",
      statusCode: 403,
      errorMessage: message,
      requiredScope,
    });

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 403 },
    );
  }
}

async function safeLogDeveloperApiRequest(
  input: Parameters<typeof logDeveloperApiRequest>[0],
) {
  try {
    await logDeveloperApiRequest(input);
  } catch (error) {
    console.error("DEVELOPER_API_REQUEST_LOG_ERROR:", error);
  }
}
