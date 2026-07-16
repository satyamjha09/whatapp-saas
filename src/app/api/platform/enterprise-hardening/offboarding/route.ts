import { NextResponse } from "next/server";
import {
  EnterpriseHardeningError,
  requestPartnerOffboarding,
} from "@/server/services/enterprise-hardening.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";
import { createPartnerOffboardingRunSchema } from "@/server/validators/enterprise-hardening.validator";

export async function POST(request: Request) {
  try {
    const platform = await requirePlatformPermission("PLATFORM_PARTNER_MANAGE");
    const input = createPartnerOffboardingRunSchema.parse(await request.json());
    const offboarding = await requestPartnerOffboarding({
      actorUserId: platform.user.id,
      actorEmail: platform.user.email,
      input,
    });

    return NextResponse.json({ ok: true, offboarding }, { status: 201 });
  } catch (error) {
    if (error instanceof EnterpriseHardeningError) {
      return NextResponse.json(
        { ok: false, code: "ENTERPRISE_HARDENING_ERROR", message: error.message },
        { status: error.status },
      );
    }

    return createTenantErrorResponse(error);
  }
}
