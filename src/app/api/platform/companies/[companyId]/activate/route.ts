import { NextResponse } from "next/server";
import { activatePlatformCompany } from "@/server/services/platform-company-control.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformAdmin } from "@/server/tenant/tenant-context";

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const platform = await requirePlatformAdmin();
    const { companyId } = await context.params;
    const company = await activatePlatformCompany({
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
