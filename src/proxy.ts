import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  getCorsHeadersForOrigin,
  setSecurityHeaders,
  shouldApplyPublicApiCors,
} from "@/lib/security-headers";
import { validateCsrfOrigin } from "@/lib/csrf-origin-guard";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/verify-email(.*)",
  "/invite(.*)",
  "/api/signup/company",
]);

function applyCorsHeaders(response: NextResponse, request: NextRequest) {
  const origin = request.headers.get("origin");
  const cors = getCorsHeadersForOrigin(origin);
  if (!cors.allowed) {
    return false;
  }
  for (const [name, value] of Object.entries(cors.headers)) {
    response.headers.set(name, value);
  }
  return true;
}

export default clerkMiddleware(async (auth, request) => {
  const requestIdHeader = process.env.APP_REQUEST_ID_HEADER ?? "x-request-id";
  const requestId = request.headers.get(requestIdHeader) ?? crypto.randomUUID();
  const pathname = request.nextUrl.pathname;
  const shouldHandleCors = shouldApplyPublicApiCors(pathname);

  const csrfValidation = validateCsrfOrigin(request);

  if (!csrfValidation.allowed) {
    const response = NextResponse.json(
      {
        message: "Forbidden by CSRF origin guard",
        reason: csrfValidation.reason,
      },
      {
        status: 403,
      },
    );

    setSecurityHeaders(response.headers);
    response.headers.set("X-CSRF-Origin-Guard", "blocked");
    response.headers.set(requestIdHeader, requestId);

    return response;
  }

  if (request.method === "OPTIONS" && shouldHandleCors) {
    const response = new NextResponse(null, {
      status: 204,
    });
    setSecurityHeaders(response.headers);
    response.headers.set(requestIdHeader, requestId);
    const corsAllowed = applyCorsHeaders(response, request);
    if (!corsAllowed && request.headers.get("origin")) {
      const deniedResponse = NextResponse.json(
        {
          message: "CORS origin is not allowed",
        },
        {
          status: 403,
        },
      );

      setSecurityHeaders(deniedResponse.headers);
      deniedResponse.headers.set(requestIdHeader, requestId);

      return deniedResponse;
    }
    return response;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  setSecurityHeaders(response.headers);
  response.headers.set(requestIdHeader, requestId);

  if (shouldHandleCors) {
    applyCorsHeaders(response, request);
  }

  if (!isPublicRoute(request)) {
    await auth.protect();
  }

  return response;
});

export const config = {
  matcher: [
    /* Skip Next internals and static files. Apply to app pages and API routes. */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
