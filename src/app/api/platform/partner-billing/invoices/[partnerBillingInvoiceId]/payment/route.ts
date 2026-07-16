import { NextResponse } from "next/server";
import {
  PartnerBillingError,
  updatePartnerBillingPayment,
} from "@/server/services/partner-billing.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";
import { updatePartnerBillingPaymentSchema } from "@/server/validators/partner-billing.validator";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ partnerBillingInvoiceId: string }> },
) {
  try {
    const platform = await requirePlatformPermission("PLATFORM_BILLING_MANAGE");
    const { partnerBillingInvoiceId } = await params;
    const input = updatePartnerBillingPaymentSchema.parse(await request.json());
    const invoice = await updatePartnerBillingPayment({
      actorUserId: platform.user.id,
      partnerBillingInvoiceId,
      input,
    });

    return NextResponse.json({
      ok: true,
      invoice,
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
