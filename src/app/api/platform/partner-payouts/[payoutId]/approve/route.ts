import { NextResponse } from "next/server";
import {
  approvePartnerPayout,
  PartnerCommissionError,
} from "@/server/services/partner-commission.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";
import { approvePartnerPayoutSchema } from "@/server/validators/partner-commission.validator";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ payoutId: string }> },
) {
  try {
    const platform = await requirePlatformPermission("PLATFORM_PAYOUT_APPROVE");
    const { payoutId } = await params;
    const input = approvePartnerPayoutSchema.parse(await request.json());
    const payout = await approvePartnerPayout({
      actorUserId: platform.user.id,
      payoutId,
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
