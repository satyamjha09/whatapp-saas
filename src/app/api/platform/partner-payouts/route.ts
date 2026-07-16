import { NextResponse } from "next/server";
import {
  getPartnerCommissionDashboard,
  PartnerCommissionError,
  requestPartnerPayout,
} from "@/server/services/partner-commission.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";
import { requestPartnerPayoutSchema } from "@/server/validators/partner-commission.validator";

export async function GET() {
  try {
    await requirePlatformPermission("PLATFORM_PAYOUT_APPROVE");
    const dashboard = await getPartnerCommissionDashboard();

    return NextResponse.json({
      ok: true,
      payouts: dashboard.payouts,
      partners: dashboard.partners,
      totals: dashboard.totals,
    });
  } catch (error) {
    return createTenantErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const platform = await requirePlatformPermission("PLATFORM_PAYOUT_APPROVE");
    const input = requestPartnerPayoutSchema.parse(await request.json());
    const payout = await requestPartnerPayout({
      actorUserId: platform.user.id,
      input,
    });

    return NextResponse.json({
      ok: true,
      payout,
    });
  } catch (error) {
    if (error instanceof PartnerCommissionError) {
      return NextResponse.json(
        {
          ok: false,
          code: "PARTNER_PAYOUT_ERROR",
          message: error.message,
        },
        { status: error.status },
      );
    }

    return createTenantErrorResponse(error);
  }
}
