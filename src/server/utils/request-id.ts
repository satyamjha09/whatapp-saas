import crypto from "node:crypto";

export function getRequestIdFromRequest(request: Request) {
  const headerName = process.env.APP_REQUEST_ID_HEADER ?? "x-request-id";
  const existingRequestId = request.headers.get(headerName);

  return existingRequestId || crypto.randomUUID();
}

export function setRequestIdHeader(headers: Headers, requestId: string) {
  const headerName = process.env.APP_REQUEST_ID_HEADER ?? "x-request-id";

  headers.set(headerName, requestId);
}
