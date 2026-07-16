import { NextResponse } from "next/server";
import {
  PartnerClientProvisioningError,
  retryPartnerClientProvisioningJob,
} from "@/server/services/partner-client-provisioning.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const platform = await requirePlatformPermission("PLATFORM_PARTNER_MANAGE");
    const { jobId } = await context.params;
    const job = await retryPartnerClientProvisioningJob({
      actorUserId: platform.user.id,
      jobId,
    });

    return NextResponse.json({
      ok: true,
      job,
    });
  } catch (error) {
    if (error instanceof PartnerClientProvisioningError) {
      return NextResponse.json(
        {
          ok: false,
          code: "PARTNER_CLIENT_PROVISIONING_ERROR",
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
