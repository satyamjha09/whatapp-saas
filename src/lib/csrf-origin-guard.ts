import type { NextRequest } from "next/server";

type CsrfValidationResult = {
  allowed: boolean;
  reason: string;
  checked: boolean;
  origin?: string | null;
  referer?: string | null;
};

function parseCsv(value: string | undefined | null) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function isCsrfOriginGuardEnabled() {
  return process.env.CSRF_ORIGIN_GUARD_ENABLED !== "false";
}

export function isMutatingHttpMethod(method: string) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

function getAppOrigin() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;

  if (!appUrl) return null;

  try {
    return new URL(appUrl).origin;
  } catch {
    return null;
  }
}

export function getCsrfExcludedPathPrefixes() {
  return unique([
    "/api/webhooks",
    "/api/security/csp-report",
    "/api/health",
    "/api/public",
    "/api/v1",
    "/api/auth",
    "/api/clerk",
    ...parseCsv(process.env.CSRF_EXCLUDED_PATH_PREFIXES),
  ]);
}

export function isCsrfExcludedPath(pathname: string) {
  return getCsrfExcludedPathPrefixes().some((prefix) =>
    pathname.startsWith(prefix),
  );
}

export function getTrustedCsrfOrigins({
  requestOrigin,
}: {
  requestOrigin?: string | null;
} = {}) {
  return unique([
    ...parseCsv(process.env.CSRF_TRUSTED_ORIGINS),
    ...(getAppOrigin() ? [getAppOrigin()!] : []),
    ...(!isProduction() && requestOrigin ? [requestOrigin] : []),
  ]);
}

function getOriginFromReferer(referer: string | null) {
  if (!referer) return null;

  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export function validateCsrfOrigin(request: NextRequest): CsrfValidationResult {
  if (!isCsrfOriginGuardEnabled()) {
    return {
      allowed: true,
      checked: false,
      reason: "CSRF origin guard is disabled",
    };
  }

  if (!isMutatingHttpMethod(request.method)) {
    return {
      allowed: true,
      checked: false,
      reason: "Non-mutating HTTP method",
    };
  }

  const pathname = request.nextUrl.pathname;

  if (isCsrfExcludedPath(pathname)) {
    return {
      allowed: true,
      checked: false,
      reason: "Path is excluded from CSRF origin guard",
    };
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const refererOrigin = getOriginFromReferer(referer);
  const candidateOrigin = origin ?? refererOrigin;

  if (!candidateOrigin) {
    const allowMissingOrigin =
      process.env.CSRF_ALLOW_MISSING_ORIGIN === "true" || !isProduction();

    return {
      allowed: allowMissingOrigin,
      checked: true,
      origin,
      referer,
      reason: allowMissingOrigin
        ? "Missing Origin/Referer allowed by environment"
        : "Missing Origin/Referer on protected mutating request",
    };
  }

  const trustedOrigins = getTrustedCsrfOrigins({
    requestOrigin: request.nextUrl.origin,
  });

  if (trustedOrigins.includes(candidateOrigin)) {
    return {
      allowed: true,
      checked: true,
      origin,
      referer,
      reason: "Origin is trusted",
    };
  }

  return {
    allowed: false,
    checked: true,
    origin,
    referer,
    reason: `Untrusted origin: ${candidateOrigin}`,
  };
}

export function getCsrfOriginGuardSummary() {
  return {
    enabled: isCsrfOriginGuardEnabled(),
    allowMissingOrigin:
      process.env.CSRF_ALLOW_MISSING_ORIGIN === "true" || !isProduction(),
    trustedOrigins: getTrustedCsrfOrigins(),
    excludedPathPrefixes: getCsrfExcludedPathPrefixes(),
    protectedMethods: ["POST", "PUT", "PATCH", "DELETE"],
  };
}
