import { NextResponse } from "next/server";
import { z } from "zod";
import {
  addPlatformCompanyNote,
  PlatformCompanyControlError,
} from "@/server/services/platform-company-control.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformAdmin } from "@/server/tenant/tenant-context";

const schema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  visibility: z.enum(["INTERNAL", "SUPPORT", "FINANCE"]).default("INTERNAL"),
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
    const body = schema.parse(await request.json());
    const note = await addPlatformCompanyNote({
      companyId,
      actorUserId: platform.user.id,
      title: body.title,
      body: body.body,
      visibility: body.visibility,
    });

    return NextResponse.json({
      ok: true,
      note,
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
