import { NextResponse } from "next/server";
import {
  createPartnerClientProvisioningJob,
  listPartnerClientProvisioningJobs,
  PartnerClientProvisioningError,
  processPartnerClientProvisioningJob,
} from "@/server/services/partner-client-provisioning.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";
import { partnerClientProvisioningSchema } from "@/server/validators/partner-client-provisioning.validator";

export async function GET(request: Request) {
  try {
    await requirePlatformPermission("PLATFORM_PARTNER_VIEW");
    const url = new URL(request.url);
    const partnerCompanyId = url.searchParams.get("partnerCompanyId") ?? undefined;
    const jobs = await listPartnerClientProvisioningJobs({
      partnerCompanyId,
    });

    return NextResponse.json({
      ok: true,
      jobs,
    });
  } catch (error) {
    return createTenantErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const platform = await requirePlatformPermission("PLATFORM_PARTNER_MANAGE");
    const body = partnerClientProvisioningSchema.parse(await request.json());
    const idempotencyKey =
      request.headers.get("idempotency-key") ?? body.idempotencyKey;
    const job = await createPartnerClientProvisioningJob({
      actorUserId: platform.user.id,
      idempotencyKey,
      input: body,
    });

    if (!job) {
      return NextResponse.json(
        {
          ok: false,
          message: "Provisioning job could not be created.",
        },
        {
          status: 500,
        },
      );
    }

    const processed = await processPartnerClientProvisioningJob({
      actorUserId: platform.user.id,
      jobId: job.id,
    });

    return NextResponse.json({
      ok: true,
      job: processed,
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
