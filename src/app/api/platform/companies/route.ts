import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/server/tenant/tenant-context";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { getPlatformCompaniesDashboard } from "@/server/services/platform-company-control.service";

export async function GET() {
  try {
    await requirePlatformAdmin();

    const dashboard = await getPlatformCompaniesDashboard();

    return NextResponse.json({
      ok: true,
      ...dashboard,
    });
  } catch (error) {
    return createTenantErrorResponse(error);
  }
}
