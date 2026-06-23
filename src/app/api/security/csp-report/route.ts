import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  createRequestBodyErrorResponse,
  readRequestJsonWithLimit,
  readRequestTextWithLimit,
  REQUEST_BODY_LIMITS,
} from "@/server/utils/request-body-guard";
import { logger } from "@/server/utils/safe-logger";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let report: Record<string, unknown> | null = null;
    let rawBody: unknown;

    try {
      rawBody =
        contentType.includes("json") || contentType.includes("csp-report")
          ? await readRequestJsonWithLimit({
              request,
              maxBytes: REQUEST_BODY_LIMITS.cspReport(),
            })
          : {
              raw: await readRequestTextWithLimit({
                request,
                maxBytes: REQUEST_BODY_LIMITS.cspReport(),
              }),
            };
    } catch (error) {
      return createRequestBodyErrorResponse({
        request,
        error,
        source: "csp-report-endpoint",
      });
    }

    if (
      contentType.includes("application/csp-report") ||
      contentType.includes("application/json")
    ) {
      const body =
        rawBody && typeof rawBody === "object"
          ? (rawBody as Record<string, unknown>)
          : {};

      report = (body["csp-report"] as Record<string, unknown>) || null;
    }

    if (!report) {
      return NextResponse.json({ message: "Invalid CSP report" }, { status: 400 });
    }

    const documentUri = (report["document-uri"] as string) || "";
    const violatedDirective = (report["violated-directive"] as string) || "";
    const blockedUri = (report["blocked-uri"] as string) || "";

    let pathname = "";
    try {
      pathname = new URL(documentUri).pathname;
    } catch {
      pathname = documentUri;
    }

    const summary = `CSP violation: ${violatedDirective} blocked ${blockedUri} on ${pathname || "/"}`;
    
    // Determine severity: script-src or connect-src violations are considered HIGH
    let severity = "MEDIUM";
    if (violatedDirective === "script-src" || violatedDirective === "connect-src") {
      severity = "HIGH";
    }

    const userAgent = request.headers.get("user-agent") || "unknown";
    const xForwardedFor = request.headers.get("x-forwarded-for");
    const ipAddress = xForwardedFor ? xForwardedFor.split(",")[0]?.trim() : "unknown";

    const event = await prisma.securityEvent.create({
      data: {
        type: "CSP_VIOLATION",
        source: "browser",
        summary,
        severity,
        path: pathname || null,
        method: null,
        ipAddress,
        userAgent,
        metadata: report as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ message: "Report received", id: event.id });
  } catch (error) {
    logger.error("CSP report processing failed", {
      error,
      path: new URL(request.url).pathname,
    });
    return NextResponse.json({ message: "Error processing report" }, { status: 500 });
  }
}
