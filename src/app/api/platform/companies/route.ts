import { NextResponse } from "next/server";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { getPlatformCompaniesDashboard } from "@/server/services/platform-company-control.service";

export async function GET() {
  try {
    await requirePlatformPermission("PLATFORM_COMPANY_VIEW");

    const dashboard = await getPlatformCompaniesDashboard();

    return NextResponse.json({
      ok: true,
      ...dashboard,
    });
  } catch (error) {
    return createTenantErrorResponse(error);
  }
}
