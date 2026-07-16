import { NextResponse } from "next/server";
import {
  PartnerPricingError,
  upsertPartnerPriceBookItem,
} from "@/server/services/partner-pricing.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformSuperAdmin } from "@/server/tenant/tenant-context";
import { partnerPriceBookItemSchema } from "@/server/validators/partner-pricing.validator";

type RouteContext = {
  params: Promise<{
    priceBookId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const platform = await requirePlatformSuperAdmin();
    const { priceBookId } = await context.params;
    const input = partnerPriceBookItemSchema.parse(await request.json());
    const item = await upsertPartnerPriceBookItem({
      actorUserId: platform.user.id,
      priceBookId,
      input,
    });

    return NextResponse.json({
      ok: true,
      item,
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
