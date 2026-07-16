import { NextResponse } from "next/server";
import {
  EnterpriseHardeningError,
  verifyPartnerDomainOwnershipChallenge,
} from "@/server/services/enterprise-hardening.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";
import { verifyPartnerDomainChallengeSchema } from "@/server/validators/enterprise-hardening.validator";

export async function POST(request: Request) {
  try {
    const platform = await requirePlatformPermission("PLATFORM_DOMAIN_APPROVE");
    const input = verifyPartnerDomainChallengeSchema.parse(await request.json());
    const challenge = await verifyPartnerDomainOwnershipChallenge({
      actorUserId: platform.user.id,
      actorEmail: platform.user.email,
      domainId: input.domainId,
    });

    return NextResponse.json({ ok: true, challenge });
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
