import { NextResponse } from "next/server";
import {
  PARTNER_ACCESS_SESSION_COOKIE,
  PartnerClientAccessError,
  startPartnerClientAccessSession,
} from "@/server/services/partner-client-access.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { getCurrentAppUser } from "@/server/tenant/tenant-context";
import { startPartnerClientAccessSessionSchema } from "@/server/validators/partner-client-access.validator";

function requestIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentAppUser();
    const input = startPartnerClientAccessSessionSchema.parse(
      await request.json(),
    );
    const session = await startPartnerClientAccessSession({
      userId: user.id,
      actorEmail: user.email,
      input,
      ipAddress: requestIp(request),
      userAgent: request.headers.get("user-agent"),
    });
    const response = NextResponse.json({
      ok: true,
      session,
      redirectTo: "/dashboard",
    });

    response.cookies.set(PARTNER_ACCESS_SESSION_COOKIE, session.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: session.expiresAt,
    });

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
