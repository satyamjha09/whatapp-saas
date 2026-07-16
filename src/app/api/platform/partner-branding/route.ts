import { NextResponse } from "next/server";
import {
  listPartnerBrandingRecords,
  PartnerBrandingError,
  transitionPartnerBranding,
  upsertPartnerBrandingDraft,
} from "@/server/services/partner-branding.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";
import {
  partnerBrandingApprovalSchema,
  partnerBrandingDraftSchema,
} from "@/server/validators/partner-branding.validator";

export async function GET() {
  try {
    await requirePlatformPermission("PLATFORM_BRANDING_MANAGE");
    const partners = await listPartnerBrandingRecords();
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
      const input = partnerBrandingApprovalSchema.parse(body);
      const branding = await transitionPartnerBranding({
        actorUserId: context.user.id,
        actorEmail: context.user.email,
        input,
      });
      return NextResponse.json({ ok: true, branding });
    }

    const input = partnerBrandingDraftSchema.parse(body);
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
