import { CompanyType } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import {
  createPartnerSupportTicket,
  listPartnerSupportTickets,
  PartnerSupportError,
} from "@/server/services/partner-support.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requireCompanyAdmin } from "@/server/tenant/tenant-context";
import { createPartnerSupportTicketSchema } from "@/server/validators/partner-support.validator";

export async function GET() {
  try {
    const context = await requireCompanyAdmin();
    if (context.company.type !== CompanyType.PARTNER) {
      return NextResponse.json(
        { ok: false, message: "Partner workspace required." },
        { status: 403 },
      );
    }

    const tickets = await listPartnerSupportTickets({
      partnerCompanyId: context.companyId,
    });
    return NextResponse.json({ ok: true, tickets });
  } catch (error) {
    return createTenantErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireCompanyAdmin();
    if (context.company.type !== CompanyType.PARTNER) {
      return NextResponse.json(
        { ok: false, message: "Partner workspace required." },
        { status: 403 },
      );
    }

    const input = createPartnerSupportTicketSchema.parse(await request.json());
    const ticket = await createPartnerSupportTicket({
      actorUserId: context.user.id,
      actorEmail: context.user.email,
      partnerCompanyId: context.companyId,
      input,
    });
    return NextResponse.json({ ok: true, ticket }, { status: 201 });
  } catch (error) {
    if (error instanceof PartnerSupportError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }
    return createTenantErrorResponse(error);
  }
}
