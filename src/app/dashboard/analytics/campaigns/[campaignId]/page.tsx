import {
  ArrowLeft,
  BarChart3,
  CheckCheck,
  CircleX,
  IndianRupee,
  Send,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
import { getCampaignAnalyticsDetail } from "@/server/services/campaign-analytics-v2.service";
import SyncCampaignAnalyticsButton from "../sync-campaign-analytics-button";

type PageProps = {
  params: Promise<{
    campaignId: string;
  }>;
};

function percent(bps?: number | null) {
  return `${((bps ?? 0) / 100).toFixed(2)}%`;
}

function money(paise?: number | null) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format((paise ?? 0) / 100);
}

export default async function CampaignAnalyticsDetailPage({
  params,
}: PageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const { campaignId } = await params;
  const campaign = await getCampaignAnalyticsDetail({
    companyId: context.membership.companyId,
    campaignId,
  });

  if (!campaign) {
    notFound();
  }

  const snapshot = campaign.analyticsSnapshot;

  return (
    <div>
      <PageHeader
        eyebrow={`${campaign.status} - ${campaign.template?.name ?? "No template"}`}
        title={campaign.name}
        description={`Created ${campaign.createdAt.toLocaleString()}`}
        actions={
          <>
            <Link
              href="/dashboard/analytics/campaigns"
              className={actionButtonClass("secondary")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Campaign Analytics
            </Link>
            <SyncCampaignAnalyticsButton campaignId={campaign.id} />
          </>
        }
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Send}
          label="Contacts"
          value={(
            snapshot?.totalContacts ?? campaign.totalContacts
          ).toLocaleString("en-IN")}
        />
        <MetricCard
          icon={CheckCheck}
          label="Delivered"
          value={(
            snapshot?.deliveredCount ?? campaign.deliveredCount
          ).toLocaleString("en-IN")}
          detail={percent(snapshot?.deliveredRateBps)}
        />
        <MetricCard
          icon={CheckCheck}
          label="Read"
          value={(snapshot?.readCount ?? campaign.readCount).toLocaleString(
            "en-IN",
          )}
          detail={percent(snapshot?.readRateBps)}
        />
        <MetricCard
          icon={IndianRupee}
          label="Cost"
          value={money(snapshot?.totalCostPaise)}
        />
      </section>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={CheckCheck}
          label="Replies"
          value={(snapshot?.repliedCount ?? 0).toLocaleString("en-IN")}
          detail={percent(snapshot?.replyRateBps)}
        />
        <MetricCard
          icon={CircleX}
          label="Opt-outs"
          value={(snapshot?.optedOutCount ?? 0).toLocaleString("en-IN")}
          detail={percent(snapshot?.optOutRateBps)}
        />
        <MetricCard
          icon={CircleX}
          label="Failed"
          value={(snapshot?.failedCount ?? campaign.failedCount).toLocaleString(
            "en-IN",
          )}
          detail={percent(snapshot?.failureRateBps)}
        />
        <MetricCard
          icon={BarChart3}
          label="Snapshot"
          value={snapshot?.status ?? "Never"}
          detail={
            snapshot?.lastSyncedAt
              ? `Synced ${snapshot.lastSyncedAt.toLocaleString()}`
              : "Click sync to create"
          }
        />
      </section>

      {snapshot?.errorMessage ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {snapshot.errorMessage}
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelTitle
            title="Recent replies"
            description="Inbound messages attributed to this campaign within the configured reply window."
          />

          <div className="mt-5 space-y-3">
            {campaign.replyAttributions.map((reply) => (
              <div
                key={reply.id}
                className="rounded-xl border border-[#BFE9D0] bg-[#F4FCF7] p-4"
              >
                <p className="font-semibold text-[#081B3A]">
                  {reply.contact.name ?? reply.contact.phoneNumber}
                </p>
                <p className="mt-1 line-clamp-3 text-sm text-[#526173]">
                  {reply.message.body}
                </p>
                <p className="mt-2 text-xs text-[#526173]">
                  {reply.repliedAt.toLocaleString()}
                </p>
              </div>
            ))}

            {campaign.replyAttributions.length === 0 ? (
              <EmptyState>No replies attributed yet.</EmptyState>
            ) : null}
          </div>
        </Panel>

        <Panel>
          <PanelTitle
            title="Recent messages"
            description="Latest messages connected to this campaign."
          />

          <div className="mt-5 space-y-3">
            {campaign.messages.map((message) => (
              <div
                key={message.id}
                className="rounded-xl border border-[#BFE9D0] bg-[#F4FCF7] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill
                      tone={
                        message.direction === "INBOUND" ? "blue" : "violet"
                      }
                    >
                      {message.direction}
                    </StatusPill>
                    <StatusPill tone={statusTone(message.status)}>
                      {message.status}
                    </StatusPill>
                  </div>
                  <p className="text-xs text-[#526173]">
                    {message.createdAt.toLocaleString()}
                  </p>
                </div>

                <p className="mt-3 text-sm font-semibold text-[#081B3A]">
                  {message.contact.name ?? message.contact.phoneNumber}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-[#526173]">
                  {message.body}
                </p>
              </div>
            ))}

            {campaign.messages.length === 0 ? (
              <EmptyState>No messages connected yet.</EmptyState>
            ) : null}
          </div>
        </Panel>
      </section>
    </div>
  );
}
