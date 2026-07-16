import { NextResponse } from "next/server";
import {
  createPlatformApprovalRequest,
  EnterpriseHardeningError,
  listPlatformApprovalRequests,
} from "@/server/services/enterprise-hardening.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";
import { createPlatformApprovalRequestSchema } from "@/server/validators/enterprise-hardening.validator";

export async function GET() {
  try {
    await requirePlatformPermission("PLATFORM_AUDIT_VIEW");
    const approvals = await listPlatformApprovalRequests();

    return NextResponse.json({ ok: true, approvals });
  } catch (error) {
    return createTenantErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const platform = await requirePlatformPermission("PLATFORM_PARTNER_MANAGE");
    const input = createPlatformApprovalRequestSchema.parse(await request.json());
    const approval = await createPlatformApprovalRequest({
      actorUserId: platform.user.id,
      actorEmail: platform.user.email,
      input,
    });

    return NextResponse.json({ ok: true, approval }, { status: 201 });
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
