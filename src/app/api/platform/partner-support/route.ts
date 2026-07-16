import { NextResponse } from "next/server";
import {
  listPlatformPartnerSupportTickets,
  PartnerSupportError,
} from "@/server/services/partner-support.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";

export async function GET() {
  try {
    await requirePlatformPermission("PLATFORM_SUPPORT_VIEW");
    const tickets = await listPlatformPartnerSupportTickets();
    return NextResponse.json({ ok: true, tickets });
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
