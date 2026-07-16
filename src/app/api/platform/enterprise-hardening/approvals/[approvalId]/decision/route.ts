import { NextResponse } from "next/server";
import {
  decidePlatformApprovalRequest,
  EnterpriseHardeningError,
} from "@/server/services/enterprise-hardening.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformSuperAdmin } from "@/server/tenant/tenant-context";
import { platformApprovalDecisionSchema } from "@/server/validators/enterprise-hardening.validator";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ approvalId: string }> },
) {
  try {
    const platform = await requirePlatformSuperAdmin();
    const { approvalId } = await params;
    const input = platformApprovalDecisionSchema.parse(await request.json());
    const approval = await decidePlatformApprovalRequest({
      actorUserId: platform.user.id,
      actorEmail: platform.user.email,
      approvalId,
      input,
    });

    return NextResponse.json({ ok: true, approval });
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
