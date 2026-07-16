import { NextResponse } from "next/server";
import {
  PartnerBillingError,
  updatePartnerSubscriptionBillingOwner,
} from "@/server/services/partner-billing.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";
import { updatePartnerBillingOwnerSchema } from "@/server/validators/partner-billing.validator";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ subscriptionId: string }> },
) {
  try {
    const platform = await requirePlatformPermission("PLATFORM_BILLING_MANAGE");
    const { subscriptionId } = await params;
    const input = updatePartnerBillingOwnerSchema.parse(await request.json());
    const subscription = await updatePartnerSubscriptionBillingOwner({
      actorUserId: platform.user.id,
      subscriptionId,
      input,
    });

    return NextResponse.json({
      ok: true,
      subscription,
    });
  } catch (error) {
    if (error instanceof PartnerBillingError) {
      return NextResponse.json(
        {
          ok: false,
          code: "PARTNER_BILLING_ERROR",
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
