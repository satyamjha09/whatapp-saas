import { rowsToCsv } from "@/lib/csv";
import { requireMember } from "@/server/auth/authorization";
import { createAuditLog } from "@/server/services/audit.service";
import {
  campaignAnalyticsToCsvRow,
  getCampaignAnalyticsList,
} from "@/server/services/campaign-analytics-v2.service";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";

const HEADERS = [
  "Campaign ID",
  "Name",
  "Status",
  "Template",
  "Total Contacts",
  "Sent",
  "Delivered",
  "Read",
  "Failed",
  "Replies",
  "Opt-outs",
  "Total Cost Paise",
  "Sent Rate Percent",
  "Delivered Rate Percent",
  "Read Rate Percent",
  "Reply Rate Percent",
  "Opt-out Rate Percent",
  "Created At",
  "Last Synced At",
];

export async function GET() {
  let workspace;

  try {
    workspace = await requireMember();
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const campaigns = await getCampaignAnalyticsList({
    companyId: workspace.membership.companyId,
    take: 1000,
  });
  const csv = rowsToCsv([
    HEADERS,
    ...campaigns.map(campaignAnalyticsToCsvRow),
  ]);
  const date = new Date().toISOString().slice(0, 10);

  await createAuditLog({
    companyId: workspace.membership.companyId,
    actorUserId: workspace.user.id,
    action: "campaign_analytics.exported",
    entityType: "CampaignAnalyticsSnapshot",
    metadata: {
      rows: campaigns.length,
    },
  });

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="campaign-analytics-${date}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
