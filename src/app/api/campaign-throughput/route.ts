import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/authorization";
import { getCampaignThroughputDashboard } from "@/server/services/campaign-throughput-guard.service";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";

export async function GET(request: Request) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const url = new URL(request.url);
  const dashboard = await getCampaignThroughputDashboard({
    campaignId: url.searchParams.get("campaignId"),
    companyId: workspace.membership.companyId,
  });

  return NextResponse.json({ ok: true, ...dashboard });
}
