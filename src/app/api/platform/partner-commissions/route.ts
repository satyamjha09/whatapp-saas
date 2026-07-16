import { NextResponse } from "next/server";
import {
  accrueCommissionForPartnerInvoice,
  createPartnerCommissionRule,
  getPartnerCommissionDashboard,
  markPartnerCommissionsAvailable,
  PartnerCommissionError,
  reversePartnerCommissionAccrual,
} from "@/server/services/partner-commission.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";
import {
  accruePartnerCommissionSchema,
  createPartnerCommissionRuleSchema,
  markPartnerCommissionsAvailableSchema,
  reversePartnerCommissionSchema,
} from "@/server/validators/partner-commission.validator";

export async function GET() {
  try {
    await requirePlatformPermission("PLATFORM_COMMISSION_MANAGE");
    const dashboard = await getPartnerCommissionDashboard();

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
    const platform = await requirePlatformPermission(
      "PLATFORM_COMMISSION_MANAGE",
    );
    const body = await request.json();
    const action = body?.action;

    if (action === "create_rule") {
      const input = createPartnerCommissionRuleSchema.parse(body);
      const rule = await createPartnerCommissionRule({
        actorUserId: platform.user.id,
        input,
      });

      return NextResponse.json({ ok: true, rule });
    }

    if (action === "accrue_invoice") {
      const input = accruePartnerCommissionSchema.parse(body);
      const accrual = await accrueCommissionForPartnerInvoice({
        actorUserId: platform.user.id,
        partnerBillingInvoiceId: input.partnerBillingInvoiceId,
      });

      return NextResponse.json({ ok: true, accrual });
    }

    if (action === "reverse") {
      const input = reversePartnerCommissionSchema.parse(body);
      const accrual = await reversePartnerCommissionAccrual({
        actorUserId: platform.user.id,
        input,
      });

      return NextResponse.json({ ok: true, accrual });
    }

    if (action === "mark_available") {
      const input = markPartnerCommissionsAvailableSchema.parse(body);
      const result = await markPartnerCommissionsAvailable({
        actorUserId: platform.user.id,
        asOf: input.asOf,
      });

      return NextResponse.json({ ok: true, result });
    }

    return NextResponse.json(
      {
        ok: false,
        message: "Unsupported partner commission action.",
      },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof PartnerCommissionError) {
      return NextResponse.json(
        {
          ok: false,
          code: "PARTNER_COMMISSION_ERROR",
          message: error.message,
        },
        { status: error.status },
      );
    }

    return createTenantErrorResponse(error);
  }
}
