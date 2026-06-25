import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/server/tenant/tenant-context";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import {
  PlatformCompanyControlError,
  suspendPlatformCompany,
} from "@/server/services/platform-company-control.service";

const suspendSchema = z.object({
  reason: z.string().min(1).max(1000),
});

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const platform = await requirePlatformAdmin();
    const { companyId } = await context.params;
    const body = suspendSchema.parse(await request.json());

    const company = await suspendPlatformCompany({
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
