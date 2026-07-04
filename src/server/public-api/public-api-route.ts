import { ZodError, type ZodSchema } from "zod";
import type { DeveloperApiScope } from "@/server/config/developer-api-scopes";
import {
  completePublicApiIdempotency,
  createPublicApiIdempotencyErrorResponse,
  failPublicApiIdempotency,
  startPublicApiIdempotency,
} from "@/server/public-api/public-api-idempotency.service";
import {
  publicApiError,
  publicApiSuccess,
  publicApiValidationError,
} from "@/server/public-api/public-api-response";
import {
  authenticatePublicApiRequest,
  requirePublicApiScope,
} from "@/server/auth/public-api";
import {
  InvalidRequestBodyError,
  readRequestJsonWithLimit,
  RequestBodyTooLargeError,
  REQUEST_BODY_LIMITS,
} from "@/server/utils/request-body-guard";
import { getRequestIdFromRequest, setRequestIdHeader } from "@/server/utils/request-id";
import { logger } from "@/server/utils/safe-logger";
import {
  assertCompanyAcceptedRequiredTrustDocuments,
  LegalAcceptanceRequiredError,
  requirePublicApiAcceptance,
} from "@/server/services/trust-center.service";
import { UsageQuotaExceededError } from "@/server/services/usage-quota.service";

type HandlerContext<TBody> = {
  request: Request;
  body: TBody;
  companyId: string;
  apiKeyId: string | null;
  requestId: string;
};

async function authenticateV1(request: Request, requiredScope: DeveloperApiScope) {
  const auth = await authenticatePublicApiRequest(request);
  if (!auth.success) {
    const payload = (await auth.response.clone().json().catch(() => null)) as {
      message?: string;
    } | null;
    return {
      ok: false as const,
      status: auth.response.status,
      message: payload?.message ?? "API authentication failed",
    };
  }

  const scopeResponse = await requirePublicApiScope({
    request,
    apiKeyRecord: auth.apiKeyRecord,
    requiredScope,
  });
  if (scopeResponse) {
    const payload = (await scopeResponse.clone().json().catch(() => null)) as {
      message?: string;
    } | null;
    return {
      ok: false as const,
      status: scopeResponse.status,
      message: payload?.message ?? "API key lacks the required scope",
    };
  }

  return { ok: true as const, apiKeyRecord: auth.apiKeyRecord };
}

function authErrorCode(status: number) {
  if (status === 401) return "unauthorized" as const;
  if (status === 429) return "rate_limited" as const;
  return "forbidden" as const;
}

function knownHandlerError(error: Error, requestId: string) {
  if (error instanceof UsageQuotaExceededError) {
    return publicApiError({
      status: 402,
      code: "payment_required",
      message: error.message,
      requestId,
    });
  }

  if (error.message === "Template not found" || error.message === "Contact not found") {
    return publicApiError({ status: 404, code: "not_found", message: error.message, requestId });
  }
  if (error.message === "Subscription is past due") {
    return publicApiError({ status: 403, code: "forbidden", message: error.message, requestId });
  }
  if (error.message === "Complete company onboarding first") {
    return publicApiError({ status: 403, code: "forbidden", message: error.message, requestId });
  }
  if (error.message.includes("This template requires")) {
    return publicApiValidationError({ message: error.message, requestId });
  }
  if (
    error.message === "Insufficient wallet balance" ||
    error.message.startsWith("Monthly message limit exceeded")
  ) {
    return publicApiError({
      status: 402,
      code: "payment_required",
      message: error.message,
      requestId,
    });
  }
  return null;
}

export function createPublicApiMutationRoute<TBody>({
  schema,
  requiredScope,
  successStatus = 200,
  handler,
}: {
  schema: ZodSchema<TBody>;
  requiredScope: DeveloperApiScope;
  successStatus?: number;
  handler: (context: HandlerContext<TBody>) => Promise<unknown>;
}) {
  return async function publicApiMutationRoute(request: Request) {
    const requestId = getRequestIdFromRequest(request);
    let idempotencyRecordId: string | null = null;

    if (process.env.PUBLIC_API_V1_ENABLED === "false") {
      return publicApiError({
        status: 503,
        code: "service_unavailable",
        message: "Public API v1 is disabled",
        requestId,
      });
    }

    try {
      const auth = await authenticateV1(request, requiredScope);
      if (!auth.ok) {
        return publicApiError({
          status: auth.status,
          code: authErrorCode(auth.status),
          message: auth.message,
          requestId,
        });
      }

      if (requirePublicApiAcceptance()) {
        await assertCompanyAcceptedRequiredTrustDocuments({
          companyId: auth.apiKeyRecord.companyId,
        });
      }

      const rawBody = await readRequestJsonWithLimit({
        request,
        maxBytes: REQUEST_BODY_LIMITS.publicApi(),
      });
      const body = schema.parse(rawBody);
      const idempotency = await startPublicApiIdempotency({
        request,
        companyId: auth.apiKeyRecord.companyId,
        apiKeyId: auth.apiKeyRecord.id,
        body,
      });

      if (idempotency.replayResponse) {
        setRequestIdHeader(idempotency.replayResponse.headers, requestId);
        return idempotency.replayResponse;
      }

      idempotencyRecordId = idempotency.recordId;
      const data = await handler({
        request,
        body,
        companyId: auth.apiKeyRecord.companyId,
        apiKeyId: auth.apiKeyRecord.id,
        requestId,
      });
      const responseBody = { ok: true, data };

      await completePublicApiIdempotency({
        recordId: idempotencyRecordId,
        responseStatus: successStatus,
        responseBody,
      });

      return publicApiSuccess(data, { status: successStatus, requestId });
    } catch (error) {
      if (error instanceof ZodError) {
        return publicApiValidationError({ details: error.flatten(), requestId });
      }
      if (error instanceof RequestBodyTooLargeError) {
        return publicApiError({
          status: 413,
          code: "validation_error",
          message: error.message,
          requestId,
        });
      }
      if (error instanceof InvalidRequestBodyError) {
        return publicApiError({
          status: 400,
          code: "validation_error",
          message: error.message,
          requestId,
        });
      }

      try {
        return createPublicApiIdempotencyErrorResponse(error, requestId);
      } catch {
        // Continue through the common failure path.
      }

      await failPublicApiIdempotency({ recordId: idempotencyRecordId });

      if (error instanceof LegalAcceptanceRequiredError) {
        return publicApiError({
          status: 403,
          code: "LEGAL_ACCEPTANCE_REQUIRED",
          message: error.message,
          requestId,
        });
      }

      if (error instanceof Error) {
        const knownResponse = knownHandlerError(error, requestId);
        if (knownResponse) return knownResponse;
      }

      logger.error("Public API mutation failed", {
        error,
        path: new URL(request.url).pathname,
        requestId,
      });
      return publicApiError({
        status: 500,
        code: "internal_error",
        message: "Internal server error",
        requestId,
      });
    }
  };
}

export function createPublicApiGetRoute({
  requiredScope,
  handler,
}: {
  requiredScope: DeveloperApiScope;
  handler: (context: {
    request: Request;
    companyId: string;
    apiKeyId: string | null;
    requestId: string;
  }) => Promise<unknown>;
}) {
  return async function publicApiGetRoute(request: Request) {
    const requestId = getRequestIdFromRequest(request);

    if (process.env.PUBLIC_API_V1_ENABLED === "false") {
      return publicApiError({
        status: 503,
        code: "service_unavailable",
        message: "Public API v1 is disabled",
        requestId,
      });
    }

    try {
      const auth = await authenticateV1(request, requiredScope);
      if (!auth.ok) {
        return publicApiError({
          status: auth.status,
          code: authErrorCode(auth.status),
          message: auth.message,
          requestId,
        });
      }

      const data = await handler({
        request,
        companyId: auth.apiKeyRecord.companyId,
        apiKeyId: auth.apiKeyRecord.id,
        requestId,
      });
      return publicApiSuccess(data, { requestId });
    } catch (error) {
      logger.error("Public API GET failed", {
        error,
        path: new URL(request.url).pathname,
        requestId,
      });
      return publicApiError({
        status: 500,
        code: "internal_error",
        message: "Internal server error",
        requestId,
      });
    }
  };
}
