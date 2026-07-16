import { NextResponse } from "next/server";
import {
  grantPartnerClientAccess,
  PartnerClientAccessError,
  revokePartnerClientAccess,
} from "@/server/services/partner-client-access.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";
import {
  grantPartnerClientAccessSchema,
  revokePartnerClientAccessSchema,
} from "@/server/validators/partner-client-access.validator";

export async function POST(request: Request) {
  try {
    const platform = await requirePlatformPermission("PLATFORM_PARTNER_MANAGE");
    const input = grantPartnerClientAccessSchema.parse(await request.json());
    const grant = await grantPartnerClientAccess({
      actorUserId: platform.user.id,
      actorEmail: platform.user.email,
      input,
    });

    return NextResponse.json({
      ok: true,
      grant,
    });
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

export async function DELETE(request: Request) {
  try {
    const platform = await requirePlatformPermission("PLATFORM_PARTNER_MANAGE");
    const input = revokePartnerClientAccessSchema.parse(await request.json());
    const grant = await revokePartnerClientAccess({
      actorUserId: platform.user.id,
      actorEmail: platform.user.email,
      grantId: input.grantId,
    });

    return NextResponse.json({
      ok: true,
      grant,
    });
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
