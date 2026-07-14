import { Download } from "lucide-react";
import { redirect } from "next/navigation";
import {
  PageHeader,
  actionButtonClass,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getAdvancedCampaignAnalyticsDashboard } from "@/server/services/advanced-campaign-analytics.service";
import AdvancedCampaignDashboard from "./advanced-campaign-dashboard";

export default async function CampaignAnalyticsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const analytics = await getAdvancedCampaignAnalyticsDashboard({
    companyId: context.membership.companyId,
  });

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Campaign Analytics"
        description="Track delivery, reads, replies, conversions, revenue attribution, and campaign health from real broadcast data."
        actions={
          <a
            href="/api/reports/campaign-analytics/export"
            className={actionButtonClass("secondary")}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </a>
        }
      />

      <AdvancedCampaignDashboard analytics={analytics} />
    </div>
  );
}
