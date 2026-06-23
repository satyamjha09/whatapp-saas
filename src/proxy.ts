import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  getCorsHeadersForOrigin,
  setSecurityHeaders,
  shouldApplyPublicApiCors,
} from "@/lib/security-headers";

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
  const pathname = request.nextUrl.pathname;
  const shouldHandleCors = shouldApplyPublicApiCors(pathname);

  if (request.method === "OPTIONS" && shouldHandleCors) {
    const response = new NextResponse(null, {
      status: 204,
    });
    setSecurityHeaders(response.headers);
    const corsAllowed = applyCorsHeaders(response, request);
    if (!corsAllowed && request.headers.get("origin")) {
      return NextResponse.json(
        {
          message: "CORS origin is not allowed",
        },
        {
          status: 403,
        },
      );
    }
    return response;
  }

  const response = NextResponse.next();
  setSecurityHeaders(response.headers);

  if (shouldHandleCors) {
    applyCorsHeaders(response, request);
  }

  return response;
});

export const config = {
  matcher: [
    /* Skip Next internals and static files. Apply to app pages and API routes. */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
