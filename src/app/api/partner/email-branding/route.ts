import { CompanyType } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import {
  getPartnerEmailBrandingDraft,
  getPartnerEmailDeliveryAnalytics,
  PartnerEmailBrandingError,
  transitionPartnerEmailBranding,
  upsertPartnerEmailBrandingDraft,
} from "@/server/services/partner-email-branding.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requireCompanyAdmin } from "@/server/tenant/tenant-context";
import {
  partnerEmailBrandingActionSchema,
  partnerEmailBrandingDraftSchema,
} from "@/server/validators/partner-email-branding.validator";

export async function GET() {
  try {
    const context = await requireCompanyAdmin();

    if (context.company.type !== CompanyType.PARTNER) {
      return NextResponse.json(
        { ok: false, message: "Partner workspace required." },
        { status: 403 },
      );
    }

    const draft = await getPartnerEmailBrandingDraft(context.companyId);
    const analytics = await getPartnerEmailDeliveryAnalytics(context.companyId);
    return NextResponse.json({ ok: true, draft, analytics });
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
      const input = partnerEmailBrandingActionSchema.parse({
        ...body,
        partnerCompanyId: context.companyId,
      });
      const emailBranding = await transitionPartnerEmailBranding({
        actorUserId: context.user.id,
        actorEmail: context.user.email,
        input,
        partnerCompanyId: context.companyId,
      });
      return NextResponse.json({ ok: true, emailBranding });
    }

    const input = partnerEmailBrandingDraftSchema.parse({
      ...body,
      partnerCompanyId: context.companyId,
    });
    const emailBranding = await upsertPartnerEmailBrandingDraft({
      actorUserId: context.user.id,
      actorEmail: context.user.email,
      input: {
        ...input,
        partnerCompanyId: context.companyId,
      },
    });

    return NextResponse.json({ ok: true, emailBranding });
  } catch (error) {
    if (error instanceof PartnerEmailBrandingError) {
      return NextResponse.json(
        {
          ok: false,
          code: "PARTNER_EMAIL_BRANDING_ERROR",
          message: error.message,
        },
        { status: error.status },
      );
    }

    return createTenantErrorResponse(error);
  }
}
