import { NextResponse } from "next/server";
import {
  markOverduePartnerBillingInvoices,
  PartnerBillingError,
} from "@/server/services/partner-billing.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";
import { markPartnerBillingOverdueSchema } from "@/server/validators/partner-billing.validator";

export async function POST(request: Request) {
  try {
    const platform = await requirePlatformPermission("PLATFORM_BILLING_MANAGE");
    const input = markPartnerBillingOverdueSchema.parse(await request.json());
    const invoices = await markOverduePartnerBillingInvoices({
      actorUserId: platform.user.id,
      asOf: input.asOf ? new Date(input.asOf) : new Date(),
    });

    return NextResponse.json({
      ok: true,
      invoices,
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
