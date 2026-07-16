import { NextResponse } from "next/server";
import {
  getPartnerPricingDashboard,
  PartnerPricingError,
  upsertPartnerPriceBook,
} from "@/server/services/partner-pricing.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";
import { partnerPriceBookSchema } from "@/server/validators/partner-pricing.validator";

export async function GET() {
  try {
    await requirePlatformPermission("PLATFORM_PARTNER_VIEW");
    const partners = await getPartnerPricingDashboard();

    return NextResponse.json({
      ok: true,
      partners,
    });
  } catch (error) {
    return createTenantErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const platform = await requirePlatformPermission("PLATFORM_PARTNER_MANAGE");
    const input = partnerPriceBookSchema.parse(await request.json());
    const priceBook = await upsertPartnerPriceBook({
      actorUserId: platform.user.id,
      input,
    });

    return NextResponse.json({
      ok: true,
      priceBook,
    });
  } catch (error) {
    if (error instanceof PartnerPricingError) {
      return NextResponse.json(
        {
          ok: false,
          code: "PARTNER_PRICING_ERROR",
          message: error.message,
        },
        {
          status: error.status,
        },
      );
    }

    return createTenantErrorResponse(error);
  }
}
