import { NextResponse } from "next/server";
import {
  listPartnerEmailBrandingRecords,
  PartnerEmailBrandingError,
  transitionPartnerEmailBranding,
  upsertPartnerEmailBrandingDraft,
} from "@/server/services/partner-email-branding.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";
import {
  partnerEmailBrandingActionSchema,
  partnerEmailBrandingDraftSchema,
} from "@/server/validators/partner-email-branding.validator";

export async function GET() {
  try {
    await requirePlatformPermission("PLATFORM_BRANDING_MANAGE");
    const partners = await listPartnerEmailBrandingRecords();
    return NextResponse.json({ ok: true, partners });
  } catch (error) {
    return createTenantErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requirePlatformPermission("PLATFORM_BRANDING_MANAGE");
    const body = await request.json();

    if (typeof body?.action === "string") {
      const input = partnerEmailBrandingActionSchema.parse(body);
      const emailBranding = await transitionPartnerEmailBranding({
        actorUserId: context.user.id,
        actorEmail: context.user.email,
        input,
      });
      return NextResponse.json({ ok: true, emailBranding });
    }

    const input = partnerEmailBrandingDraftSchema.parse(body);
    if (!input.partnerCompanyId) {
      return NextResponse.json(
        { ok: false, message: "Partner company is required." },
        { status: 400 },
      );
    }

    const emailBranding = await upsertPartnerEmailBrandingDraft({
      actorUserId: context.user.id,
      actorEmail: context.user.email,
      input: {
        ...input,
        partnerCompanyId: input.partnerCompanyId,
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
