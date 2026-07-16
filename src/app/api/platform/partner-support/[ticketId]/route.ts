import { NextResponse } from "next/server";
import {
  PartnerSupportError,
  updatePartnerSupportTicket,
} from "@/server/services/partner-support.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";
import { updatePartnerSupportTicketSchema } from "@/server/validators/partner-support.validator";

type SupportTicketRouteContext = {
  params: Promise<{ ticketId: string }>;
};

export async function PATCH(request: Request, { params }: SupportTicketRouteContext) {
  try {
    const context = await requirePlatformPermission("PLATFORM_SUPPORT_ACCESS");
    const { ticketId } = await params;
    const input = updatePartnerSupportTicketSchema.parse(await request.json());
    const ticket = await updatePartnerSupportTicket({
      actorUserId: context.user.id,
      actorEmail: context.user.email,
      ticketId,
      input,
    });
    return NextResponse.json({ ok: true, ticket });
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
