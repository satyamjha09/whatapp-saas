import { NextResponse } from "next/server";
import { reactivatePlatformCompany } from "@/server/services/platform-company-control.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const platform = await requirePlatformPermission("PLATFORM_COMPANY_MANAGE");
    const { companyId } = await context.params;
    const company = await reactivatePlatformCompany({
      companyId,
      actorUserId: platform.user.id,
    });

    return NextResponse.json({
      ok: true,
      company,
    });
  } catch (error) {
    return createTenantErrorResponse(error);
  }
}
