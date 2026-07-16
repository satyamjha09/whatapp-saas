import { NextResponse } from "next/server";
import {
  createPartnerCustomDomain,
  listPartnerDomainRecords,
  PartnerCustomDomainError,
  transitionPartnerCustomDomain,
} from "@/server/services/partner-custom-domain.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";
import {
  partnerCustomDomainActionSchema,
  partnerCustomDomainCreateSchema,
} from "@/server/validators/partner-custom-domain.validator";

export async function GET() {
  try {
    await requirePlatformPermission("PLATFORM_DOMAIN_APPROVE");
    const partners = await listPartnerDomainRecords();
    return NextResponse.json({ ok: true, partners });
  } catch (error) {
    return createTenantErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requirePlatformPermission("PLATFORM_DOMAIN_APPROVE");
    const body = await request.json();

    if (typeof body?.action === "string") {
      const input = partnerCustomDomainActionSchema.parse(body);
      const domain = await transitionPartnerCustomDomain({
        actorUserId: context.user.id,
        actorEmail: context.user.email,
        input,
      });
      return NextResponse.json({ ok: true, domain });
    }

    const input = partnerCustomDomainCreateSchema.parse(body);
    if (!input.partnerCompanyId) {
      return NextResponse.json(
        { ok: false, message: "Partner company is required." },
        { status: 400 },
      );
    }

    const domain = await createPartnerCustomDomain({
      actorUserId: context.user.id,
      actorEmail: context.user.email,
      input: {
        partnerCompanyId: input.partnerCompanyId,
        domain: input.domain,
      },
    });

    return NextResponse.json({ ok: true, domain });
  } catch (error) {
    if (error instanceof PartnerCustomDomainError) {
      return NextResponse.json(
        {
          ok: false,
          code: "PARTNER_CUSTOM_DOMAIN_ERROR",
          message: error.message,
        },
        { status: error.status },
      );
    }

    return createTenantErrorResponse(error);
  }
}
