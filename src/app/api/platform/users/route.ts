import { NextResponse } from "next/server";
import { getPlatformUsersDashboard } from "@/server/services/platform-user-management.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";

export async function GET() {
  try {
    await requirePlatformPermission("PLATFORM_USER_MANAGE");
    const dashboard = await getPlatformUsersDashboard();

    return NextResponse.json({
      ok: true,
      ...dashboard,
    });
  } catch (error) {
    return createTenantErrorResponse(error);
  }
}
