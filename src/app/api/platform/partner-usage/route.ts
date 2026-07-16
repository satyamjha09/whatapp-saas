import { NextResponse } from "next/server";
import {
  aggregatePartnerUsageForDate,
  exportPartnerUsageCsv,
  getPartnerUsageDashboard,
  PartnerUsageError,
} from "@/server/services/partner-usage.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";
import {
  aggregatePartnerUsageSchema,
  partnerUsageQuerySchema,
} from "@/server/validators/partner-usage.validator";

export async function GET(request: Request) {
  try {
    await requirePlatformPermission("PLATFORM_USAGE_VIEW");
    const url = new URL(request.url);
    const query = partnerUsageQuerySchema.parse({
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      partnerCompanyId: url.searchParams.get("partnerCompanyId") ?? undefined,
      format: url.searchParams.get("format") ?? undefined,
    });

    if (query.format === "csv") {
      const csv = await exportPartnerUsageCsv(query);
      return new NextResponse(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="partner-usage-${Date.now()}.csv"`,
        },
      });
    }

    const dashboard = await getPartnerUsageDashboard(query);
    return NextResponse.json({ ok: true, dashboard });
  } catch (error) {
    if (error instanceof PartnerUsageError) {
      return NextResponse.json(
        { ok: false, code: "PARTNER_USAGE_ERROR", message: error.message },
        { status: error.status },
      );
    }

    return createTenantErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requirePlatformPermission("PLATFORM_USAGE_VIEW");
    const body = await request.json();
    const input = aggregatePartnerUsageSchema.parse(body);
    const result = await aggregatePartnerUsageForDate({
      date: input.date,
      partnerCompanyId: input.partnerCompanyId,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    if (error instanceof PartnerUsageError) {
      return NextResponse.json(
        { ok: false, code: "PARTNER_USAGE_ERROR", message: error.message },
        { status: error.status },
      );
    }

    return createTenantErrorResponse(error);
  }
}
