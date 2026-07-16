import { NextResponse } from "next/server";
import { z } from "zod";
import {
  disablePlatformCompany,
  PlatformCompanyControlError,
} from "@/server/services/platform-company-control.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformSuperAdmin } from "@/server/tenant/tenant-context";

const schema = z.object({
  reason: z.string().min(1).max(1000),
});

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const platform = await requirePlatformSuperAdmin();
    const { companyId } = await context.params;
    const body = schema.parse(await request.json());
    const company = await disablePlatformCompany({
      companyId,
      actorUserId: platform.user.id,
      reason: body.reason,
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
