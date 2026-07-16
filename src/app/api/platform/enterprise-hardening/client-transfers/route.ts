import { NextResponse } from "next/server";
import {
  EnterpriseHardeningError,
  requestPartnerClientTransfer,
} from "@/server/services/enterprise-hardening.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";
import { createPartnerClientTransferRequestSchema } from "@/server/validators/enterprise-hardening.validator";

export async function POST(request: Request) {
  try {
    const platform = await requirePlatformPermission("PLATFORM_PARTNER_MANAGE");
    const input = createPartnerClientTransferRequestSchema.parse(await request.json());
    const transfer = await requestPartnerClientTransfer({
      actorUserId: platform.user.id,
      actorEmail: platform.user.email,
      input,
    });

    return NextResponse.json({ ok: true, transfer }, { status: 201 });
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
