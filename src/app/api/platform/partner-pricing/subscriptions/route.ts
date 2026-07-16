import { NextResponse } from "next/server";
import {
  assignPartnerClientSubscription,
  cancelPartnerClientSubscription,
  PartnerPricingError,
} from "@/server/services/partner-pricing.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";
import {
  assignPartnerClientSubscriptionSchema,
  cancelPartnerClientSubscriptionSchema,
} from "@/server/validators/partner-pricing.validator";

export async function POST(request: Request) {
  try {
    const platform = await requirePlatformPermission("PLATFORM_PLAN_MANAGE");
    const input = assignPartnerClientSubscriptionSchema.parse(
      await request.json(),
    );
    const subscription = await assignPartnerClientSubscription({
      actorUserId: platform.user.id,
      input,
    });

    return NextResponse.json({
      ok: true,
      subscription,
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

export async function DELETE(request: Request) {
  try {
    const platform = await requirePlatformPermission("PLATFORM_PLAN_MANAGE");
    const input = cancelPartnerClientSubscriptionSchema.parse(
      await request.json(),
    );
    const subscription = await cancelPartnerClientSubscription({
      actorUserId: platform.user.id,
      subscriptionId: input.subscriptionId,
      cancellationNote: input.cancellationNote,
    });

    return NextResponse.json({
      ok: true,
      subscription,
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
