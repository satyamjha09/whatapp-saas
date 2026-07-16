import { NextResponse } from "next/server";
import {
  addPartnerSupportTicketComment,
  PartnerSupportError,
} from "@/server/services/partner-support.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";
import { createPartnerSupportCommentSchema } from "@/server/validators/partner-support.validator";

type SupportTicketRouteContext = {
  params: Promise<{ ticketId: string }>;
};

export async function POST(request: Request, { params }: SupportTicketRouteContext) {
  try {
    const context = await requirePlatformPermission("PLATFORM_SUPPORT_ACCESS");
    const { ticketId } = await params;
    const input = createPartnerSupportCommentSchema.parse(await request.json());
    const comment = await addPartnerSupportTicketComment({
      actorUserId: context.user.id,
      ticketId,
      body: input.body,
      visibility: input.visibility,
    });
    return NextResponse.json({ ok: true, comment }, { status: 201 });
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
