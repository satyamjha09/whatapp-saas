import { CompanyType } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import {
  createPartnerCustomDomain,
  listPartnerCustomDomains,
  PartnerCustomDomainError,
  transitionPartnerCustomDomain,
} from "@/server/services/partner-custom-domain.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requireCompanyAdmin } from "@/server/tenant/tenant-context";
import {
  partnerCustomDomainActionSchema,
  partnerCustomDomainCreateSchema,
} from "@/server/validators/partner-custom-domain.validator";

const PARTNER_ALLOWED_ACTIONS = new Set([
  "verify_dns",
  "check_health",
  "submit",
  "disable",
]);

export async function GET() {
  try {
    const context = await requireCompanyAdmin();

    if (context.company.type !== CompanyType.PARTNER) {
      return NextResponse.json(
        { ok: false, message: "Partner workspace required." },
        { status: 403 },
      );
    }

    const domains = await listPartnerCustomDomains(context.companyId);
    return NextResponse.json({ ok: true, domains });
  } catch (error) {
    return createTenantErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireCompanyAdmin();

    if (context.company.type !== CompanyType.PARTNER) {
      return NextResponse.json(
        { ok: false, message: "Partner workspace required." },
        { status: 403 },
      );
    }

    const body = await request.json();

    if (typeof body?.action === "string") {
      if (!PARTNER_ALLOWED_ACTIONS.has(body.action)) {
        return NextResponse.json(
          { ok: false, message: "This domain action requires platform review." },
          { status: 403 },
        );
      }

      const input = partnerCustomDomainActionSchema.parse({
        ...body,
        partnerCompanyId: context.companyId,
      });
      const domain = await transitionPartnerCustomDomain({
        actorUserId: context.user.id,
        actorEmail: context.user.email,
        input,
        partnerCompanyId: context.companyId,
      });
      return NextResponse.json({ ok: true, domain });
    }

    const input = partnerCustomDomainCreateSchema.parse({
      ...body,
      partnerCompanyId: context.companyId,
    });
    const domain = await createPartnerCustomDomain({
      actorUserId: context.user.id,
      actorEmail: context.user.email,
      input: {
        partnerCompanyId: context.companyId,
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
