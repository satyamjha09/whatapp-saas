import { NextResponse } from "next/server";
import { requireMember } from "@/server/auth/authorization";
import { assertTenantEntityAccess } from "@/server/auth/tenant-guard";
import { createAuditLog } from "@/server/services/audit.service";
import { syncCampaignAnalyticsSnapshot } from "@/server/services/campaign-analytics-v2.service";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import { createTenantErrorResponse } from "@/server/utils/api-tenant-error";

type RouteContext = {
  params: Promise<{
    campaignId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  let workspace;

  try {
    workspace = await requireMember();
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const { campaignId } = await context.params;

  try {
    await assertTenantEntityAccess({
      request,
      companyId: workspace.membership.companyId,
      entityType: "Campaign",
      entityId: campaignId,
    });
  } catch (error) {
    return createTenantErrorResponse(error);
  }

  try {
    const result = await syncCampaignAnalyticsSnapshot({
      companyId: workspace.membership.companyId,
      campaignId,
    });

    await createAuditLog({
      companyId: workspace.membership.companyId,
      actorUserId: workspace.user.id,
      action: "campaign.analytics_synced",
      entityType: "Campaign",
      entityId: campaignId,
    });

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to sync campaign analytics",
      },
      { status: 500 },
    );
  }
}
