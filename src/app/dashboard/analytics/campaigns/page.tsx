import { BarChart3, Download, IndianRupee, MessageCircleReply } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  EmptyState,
  MetricCard,
  PageHeader,
  Panel,
  PanelTitle,
  StatusPill,
  actionButtonClass,
  statusTone,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getCampaignAnalyticsList } from "@/server/services/campaign-analytics-v2.service";
import SyncCampaignAnalyticsButton from "./sync-campaign-analytics-button";

function percent(bps?: number | null) {
  return `${((bps ?? 0) / 100).toFixed(2)}%`;
}

function money(paise?: number | null) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format((paise ?? 0) / 100);
}

export default async function CampaignAnalyticsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const campaigns = await getCampaignAnalyticsList({
    companyId: context.membership.companyId,
  });
  const totals = campaigns.reduce(
    (total, campaign) => {
      const snapshot = campaign.analyticsSnapshot;

      return {
        campaigns: total.campaigns + 1,
        delivered:
          total.delivered +
          (snapshot?.deliveredCount ?? campaign.deliveredCount),
        replies: total.replies + (snapshot?.repliedCount ?? 0),
        cost: total.cost + (snapshot?.totalCostPaise ?? 0),
      };
    },
    { campaigns: 0, delivered: 0, replies: 0, cost: 0 },
  );

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Campaign Analytics v2"
        description="Campaign funnel performance, reply attribution, opt-outs, and wallet usage cost."
        actions={
          <a
            href="/api/reports/campaign-analytics/export"
            className={actionButtonClass()}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </a>
        }
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={BarChart3}
          label="Campaigns"
          value={totals.campaigns.toLocaleString("en-IN")}
        />
        <MetricCard
          icon={BarChart3}
          label="Delivered"
          value={totals.delivered.toLocaleString("en-IN")}
        />
        <MetricCard
          icon={MessageCircleReply}
          label="Replies"
          value={totals.replies.toLocaleString("en-IN")}
        />
        <MetricCard
          icon={IndianRupee}
          label="Usage Cost"
          value={money(totals.cost)}
        />
      </section>

      <Panel className="overflow-hidden p-0 sm:p-0">
        <div className="border-b border-[#D8E6F3] px-5 py-4 sm:px-6">
          <PanelTitle
            title="Campaign funnel"
            description="Snapshot metrics refresh on schedule and can be synced manually."
          />
        </div>

        {campaigns.length === 0 ? (
          <div className="p-5 sm:p-6">
            <EmptyState>No campaigns found.</EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="bg-[#F0F8FF] text-xs uppercase text-[#526173]">
                <tr>
                  <th className="px-5 py-3">Campaign</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Sent</th>
                  <th className="px-5 py-3">Delivered</th>
                  <th className="px-5 py-3">Read</th>
                  <th className="px-5 py-3">Replies</th>
                  <th className="px-5 py-3">Opt-outs</th>
                  <th className="px-5 py-3">Failed</th>
                  <th className="px-5 py-3">Cost</th>
                  <th className="px-5 py-3">Sync</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#D8E6F3]">
                {campaigns.map((campaign) => {
                  const snapshot = campaign.analyticsSnapshot;

                  return (
                    <tr key={campaign.id}>
                      <td className="px-5 py-4">
                        <Link
                          href={`/dashboard/analytics/campaigns/${campaign.id}`}
                          className="font-semibold text-[#081B3A] hover:underline"
                        >
                          {campaign.name}
                        </Link>
                        <p className="mt-1 text-xs text-[#526173]">
                          {campaign.template?.name ?? "-"} ·{" "}
                          {campaign.createdAt.toLocaleString()}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill tone={statusTone(campaign.status)}>
                          {campaign.status}
                        </StatusPill>
                        {snapshot?.status === "FAILED" ? (
                          <p className="mt-1 text-xs text-red-600">
                            Snapshot failed
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4">
                        {snapshot?.sentCount ?? campaign.sentCount}
                        <p className="text-xs text-[#526173]">
                          {percent(snapshot?.sentRateBps)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        {snapshot?.deliveredCount ?? campaign.deliveredCount}
                        <p className="text-xs text-[#526173]">
                          {percent(snapshot?.deliveredRateBps)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        {snapshot?.readCount ?? campaign.readCount}
                        <p className="text-xs text-[#526173]">
                          {percent(snapshot?.readRateBps)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        {snapshot?.repliedCount ?? 0}
                        <p className="text-xs text-[#526173]">
                          {percent(snapshot?.replyRateBps)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        {snapshot?.optedOutCount ?? 0}
                        <p className="text-xs text-[#526173]">
                          {percent(snapshot?.optOutRateBps)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        {snapshot?.failedCount ?? campaign.failedCount}
                        <p className="text-xs text-[#526173]">
                          {percent(snapshot?.failureRateBps)}
                        </p>
                      </td>
                      <td className="px-5 py-4 font-semibold text-[#081B3A]">
                        {money(snapshot?.totalCostPaise)}
                      </td>
                      <td className="px-5 py-4">
                        <SyncCampaignAnalyticsButton campaignId={campaign.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
