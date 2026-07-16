import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  endPartnerClientAccessSession,
  PARTNER_ACCESS_SESSION_COOKIE,
  PartnerClientAccessError,
} from "@/server/services/partner-client-access.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { getCurrentAppUser } from "@/server/tenant/tenant-context";

export async function DELETE() {
  try {
    const user = await getCurrentAppUser();
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(PARTNER_ACCESS_SESSION_COOKIE)?.value;

    if (sessionId) {
      await endPartnerClientAccessSession({
        userId: user.id,
        actorEmail: user.email,
        sessionId,
      });
    }

    const response = NextResponse.json({
      ok: true,
      redirectTo: "/dashboard",
    });
    response.cookies.delete(PARTNER_ACCESS_SESSION_COOKIE);

    return response;
  } catch (error) {
    if (error instanceof PartnerClientAccessError) {
      return NextResponse.json(
        {
          ok: false,
          code: "PARTNER_CLIENT_ACCESS_ERROR",
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
