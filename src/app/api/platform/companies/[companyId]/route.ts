import { NextResponse } from "next/server";
import {
  getPlatformCompanyDetail,
  PlatformCompanyControlError,
} from "@/server/services/platform-company-control.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const platform = await requirePlatformPermission("PLATFORM_COMPANY_VIEW");
    const { companyId } = await context.params;
    const company = await getPlatformCompanyDetail({
      companyId,
      actorUserId: platform.user.id,
    });

    return NextResponse.json({
      ok: true,
      company,
    });
  } catch (error) {
    if (error instanceof PlatformCompanyControlError) {
      return NextResponse.json(
        {
          ok: false,
          code: "PLATFORM_COMPANY_CONTROL_ERROR",
          message: error.message,
        },
        {
          status: 400,
        },
      );
    }

    return createTenantErrorResponse(error);
  }
}
