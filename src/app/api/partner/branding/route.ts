import { CompanyType } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import {
  getPartnerBrandingDraft,
  PartnerBrandingError,
  transitionPartnerBranding,
  upsertPartnerBrandingDraft,
} from "@/server/services/partner-branding.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requireCompanyAdmin } from "@/server/tenant/tenant-context";
import {
  partnerBrandingApprovalSchema,
  partnerBrandingDraftSchema,
} from "@/server/validators/partner-branding.validator";

export async function GET() {
  try {
    const context = await requireCompanyAdmin();

    if (context.company.type !== CompanyType.PARTNER) {
      return NextResponse.json(
        { ok: false, message: "Partner workspace required." },
        { status: 403 },
      );
    }

    const draft = await getPartnerBrandingDraft(context.companyId);
    return NextResponse.json({ ok: true, draft });
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

    if (body?.action === "submit") {
      const input = partnerBrandingApprovalSchema.parse({
        ...body,
        partnerCompanyId: context.companyId,
      });
      const branding = await transitionPartnerBranding({
        actorUserId: context.user.id,
        actorEmail: context.user.email,
        input,
      });
      return NextResponse.json({ ok: true, branding });
    }

    const input = partnerBrandingDraftSchema.parse({
      ...body,
      partnerCompanyId: context.companyId,
    });
    const branding = await upsertPartnerBrandingDraft({
      actorUserId: context.user.id,
      actorEmail: context.user.email,
      input,
    });
    return NextResponse.json({ ok: true, branding });
  } catch (error) {
    if (error instanceof PartnerBrandingError) {
      return NextResponse.json(
        { ok: false, code: "PARTNER_BRANDING_ERROR", message: error.message },
        { status: error.status },
      );
    }

    return createTenantErrorResponse(error);
  }
}
