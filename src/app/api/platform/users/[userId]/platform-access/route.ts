import { NextResponse } from "next/server";
import { z } from "zod";
import type { PlatformRole } from "@/generated/prisma/client";
import {
  PlatformUserManagementError,
  updatePlatformUserAccess,
} from "@/server/services/platform-user-management.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformSuperAdmin } from "@/server/tenant/tenant-context";

const platformAccessSchema = z.object({
  platformAccessEnabled: z.boolean(),
  platformRole: z.enum(["NONE", "SUPPORT", "FINANCE", "ADMIN", "SUPER_ADMIN"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const platform = await requirePlatformSuperAdmin();
    const { userId } = await params;
    const input = platformAccessSchema.parse(await request.json());
    const user = await updatePlatformUserAccess({
      actorEmail: platform.user.email,
      actorUserId: platform.user.id,
      targetUserId: userId,
      platformAccessEnabled: input.platformAccessEnabled,
      platformRole: input.platformRole as PlatformRole,
    });

    return NextResponse.json({
      ok: true,
      user,
    });
  } catch (error) {
    if (error instanceof PlatformUserManagementError) {
      return NextResponse.json(
        {
          ok: false,
          code: "PLATFORM_USER_MANAGEMENT_ERROR",
          message: error.message,
        },
        {
          status: error.status,
        },
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "Invalid platform access payload.",
          issues: error.issues,
        },
        {
          status: 400,
        },
      );
    }

    return createTenantErrorResponse(error);
  }
}
