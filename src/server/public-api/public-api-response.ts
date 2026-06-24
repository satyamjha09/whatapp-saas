import { NextResponse } from "next/server";
import { setRequestIdHeader } from "@/server/utils/request-id";

export type PublicApiErrorCode =
  | "LEGAL_ACCEPTANCE_REQUIRED"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation_error"
  | "rate_limited"
  | "payment_required"
  | "idempotency_conflict"
  | "idempotency_key_required"
  | "processing"
  | "service_unavailable"
  | "internal_error";

function responseHeaders(requestId?: string | null) {
  const headers = new Headers();
  if (requestId) setRequestIdHeader(headers, requestId);
  return headers;
}

export function publicApiSuccess<TData>(
  data: TData,
  {
    status = 200,
    requestId,
  }: { status?: number; requestId?: string | null } = {},
) {
  return NextResponse.json(
    { ok: true, data },
    { status, headers: responseHeaders(requestId) },
  );
}

export function publicApiError({
  status,
  code,
  message,
  details,
  requestId,
}: {
  status: number;
  code: PublicApiErrorCode;
  message: string;
  details?: unknown;
  requestId?: string | null;
}) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
        ...(requestId ? { requestId } : {}),
      },
    },
    { status, headers: responseHeaders(requestId) },
  );
}

export function publicApiValidationError({
  message = "Validation failed",
  details,
  requestId,
}: {
  message?: string;
  details?: unknown;
  requestId?: string | null;
}) {
  return publicApiError({
    status: 422,
    code: "validation_error",
    message,
    details,
    requestId,
  });
}
