import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let report: Record<string, unknown> | null = null;

    if (contentType.includes("application/csp-report") || contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
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
    console.error("CSP_REPORT_ERROR:", error);
    return NextResponse.json({ message: "Error processing report" }, { status: 500 });
  }
}
