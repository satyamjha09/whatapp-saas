import { ZodError, type ZodSchema } from "zod";
import type { DeveloperApiScope } from "@/server/config/developer-api-scopes";
import {
  authenticatePublicApiRequest,
  requirePublicApiScope,
} from "@/server/auth/public-api";
import {
  publicApiError,
  publicApiSuccess,
  publicApiValidationError,
} from "@/server/public-api/public-api-response";
import { PartnerApiError } from "@/server/services/partner-api.service";
import {
  InvalidRequestBodyError,
  readRequestJsonWithLimit,
  RequestBodyTooLargeError,
  REQUEST_BODY_LIMITS,
} from "@/server/utils/request-body-guard";
import { getRequestIdFromRequest } from "@/server/utils/request-id";
import { logger } from "@/server/utils/safe-logger";

type PartnerApiContext<TBody = never> = {
  request: Request;
  body: TBody;
  partnerCompanyId: string;
  apiKeyId: string;
  apiKeyCreatedByUserId?: string | null;
  requestId: string;
};

function authErrorResponse({
  message,
  requestId,
  status,
}: {
  status: number;
  message: string;
  requestId: string;
}) {
  return publicApiError({
    status,
    code: status === 401 ? "unauthorized" : status === 429 ? "rate_limited" : "forbidden",
    message,
    requestId,
  });
}

async function authenticatePartnerApi(request: Request, requiredScope: DeveloperApiScope) {
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

  if (auth.apiKeyRecord.company.type !== "PARTNER") {
    return {
      ok: false as const,
      status: 403,
      message: "Partner API keys must belong to an active partner workspace.",
    };
  }

  if (auth.apiKeyRecord.company.status !== "ACTIVE") {
    return {
      ok: false as const,
      status: 403,
      message: "Partner workspace is not active.",
    };
  }

  return { ok: true as const, apiKeyRecord: auth.apiKeyRecord };
}

function handlePartnerApiError({
  error,
  request,
  requestId,
}: {
  error: unknown;
  request: Request;
  requestId: string;
}) {
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
  if (error instanceof PartnerApiError) {
    return publicApiError({
      status: error.status,
      code: error.status === 404 ? "not_found" : "forbidden",
      message: error.message,
      requestId,
    });
  }

  logger.error("Partner API route failed", {
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

export function createPartnerApiGetRoute({
  handler,
  requiredScope,
}: {
  requiredScope: DeveloperApiScope;
  handler: (context: Omit<PartnerApiContext, "body">) => Promise<unknown>;
}) {
  return async function partnerApiGetRoute(request: Request) {
    const requestId = getRequestIdFromRequest(request);
    const auth = await authenticatePartnerApi(request, requiredScope);

    if (!auth.ok) {
      return authErrorResponse({
        status: auth.status,
        message: auth.message,
        requestId,
      });
    }

    try {
      const data = await handler({
        request,
        partnerCompanyId: auth.apiKeyRecord.companyId,
        apiKeyId: auth.apiKeyRecord.id,
        apiKeyCreatedByUserId: auth.apiKeyRecord.createdByUserId,
        requestId,
      });
      return publicApiSuccess(data, { requestId });
    } catch (error) {
      return handlePartnerApiError({ error, request, requestId });
    }
  };
}

export function createPartnerApiMutationRoute<TBody>({
  handler,
  requiredScope,
  schema,
  successStatus = 200,
}: {
  requiredScope: DeveloperApiScope;
  schema: ZodSchema<TBody>;
  successStatus?: number;
  handler: (context: PartnerApiContext<TBody>) => Promise<unknown>;
}) {
  return async function partnerApiMutationRoute(request: Request) {
    const requestId = getRequestIdFromRequest(request);
    const auth = await authenticatePartnerApi(request, requiredScope);

    if (!auth.ok) {
      return authErrorResponse({
        status: auth.status,
        message: auth.message,
        requestId,
      });
    }

    try {
      const rawBody = await readRequestJsonWithLimit({
        request,
        maxBytes: REQUEST_BODY_LIMITS.publicApi(),
      });
      const body = schema.parse(rawBody);
      const data = await handler({
        request,
        body,
        partnerCompanyId: auth.apiKeyRecord.companyId,
        apiKeyId: auth.apiKeyRecord.id,
        apiKeyCreatedByUserId: auth.apiKeyRecord.createdByUserId,
        requestId,
      });
      return publicApiSuccess(data, { status: successStatus, requestId });
    } catch (error) {
      return handlePartnerApiError({ error, request, requestId });
    }
  };
}
