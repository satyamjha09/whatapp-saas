import { NextResponse } from "next/server";
import {
  generatePartnerBillingInvoices,
  getPartnerBillingDashboard,
  PartnerBillingError,
} from "@/server/services/partner-billing.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";
import { generatePartnerBillingInvoiceSchema } from "@/server/validators/partner-billing.validator";

export async function GET() {
  try {
    await requirePlatformPermission("PLATFORM_BILLING_VIEW");
    const dashboard = await getPartnerBillingDashboard();

    return NextResponse.json({
      ok: true,
      dashboard,
    });
  } catch (error) {
    return createTenantErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const platform = await requirePlatformPermission("PLATFORM_BILLING_MANAGE");
    const input = generatePartnerBillingInvoiceSchema.parse(await request.json());
    const invoices = await generatePartnerBillingInvoices({
      actorUserId: platform.user.id,
      input,
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
