import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCheck,
  Clock,
  Eye,
  MessageSquareReply,
  RadioTower,
  Send,
  Users,
} from "lucide-react";
import {
  MetricCard,
  PageHeader,
  Panel,
  PanelTitle,
  StatusPill,
  actionButtonClass,
  statusTone,
} from "@/app/dashboard/dashboard-ui";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import CampaignRetargetingCard from "@/app/dashboard/campaigns/[campaignId]/campaign-retargeting-card";
import { BroadcastCampaignActions } from "../_components/broadcast-campaign-actions";
import { BroadcastReportActions } from "../_components/broadcast-report-actions";

type BroadcastDetailPageProps = {
  params: Promise<{
    campaignId: string;
  }>;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function formatMoneyPaise(value: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value / 100);
}

function formatDateTime(date: Date | null) {
  if (!date) return "Not available";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function percent(part: number, total: number) {
  if (total <= 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

export default async function BroadcastDetailPage({
  params,
}: BroadcastDetailPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const { campaignId } = await params;
  const companyId = context.membership.companyId;
  const canManage =
    context.membership.role === "OWNER" ||
    context.membership.role === "ADMIN";

  const campaign = await prisma.campaign.findFirst({
    where: { companyId, id: campaignId },
    include: {
      template: {
        select: {
          category: true,
          language: true,
          name: true,
        },
      },
      _count: {
        select: {
          conversionEvents: true,
          replyAttributions: true,
        },
      },
    },
  });

  if (!campaign) {
    const bulkBatch = await prisma.bulkMessageBatch.findFirst({
      where: { companyId, id: campaignId },
      select: { id: true },
    });

    if (bulkBatch) {
      redirect(`/dashboard/campaigns/${campaignId}`);
    }

    notFound();
  }

  const latestRun = await prisma.campaignLaunchRun.findFirst({
    where: { campaignId, companyId },
    orderBy: { createdAt: "desc" },
  });

  const latestReport = await prisma.campaignCompletionReport.findFirst({
    where: { campaignId, companyId },
    orderBy: { generatedAt: "desc" },
    select: {
      actualCostPaise: true,
      deliveryRate: true,
      failedMessages: true,
      generatedAt: true,
      id: true,
      readRate: true,
      replyCount: true,
      status: true,
      totalMessages: true,
    },
  });

  const recipientGroups = latestRun
    ? await prisma.campaignLaunchRecipient.groupBy({
        by: ["status"],
        where: {
          companyId,
          launchRunId: latestRun.id,
        },
        _count: { _all: true },
      })
    : [];

  const recentFailures = latestRun
    ? await prisma.campaignLaunchRecipient.findMany({
        where: {
          companyId,
          launchRunId: latestRun.id,
          status: "FAILED",
        },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: {
          failureReason: true,
          id: true,
          phoneMasked: true,
          updatedAt: true,
        },
      })
    : [];

  const statusCount = Object.fromEntries(
    recipientGroups.map((group) => [group.status, group._count._all]),
  );
  const planned = Number(statusCount.PLANNED ?? 0);
  const queued = Number(statusCount.QUEUED ?? 0);
  const failed = Number(statusCount.FAILED ?? 0);
  const created = Number(statusCount.MESSAGE_CREATED ?? 0);
  const activeRunStatuses = [
    "DRY_RUN_CREATED",
    "WALLET_RESERVED",
    "QUEUING",
    "RUNNING",
  ];
  const canCancelRun =
    canManage && latestRun ? activeRunStatuses.includes(latestRun.status) : false;

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title={campaign.name}
        description="Control this broadcast launch, inspect the runtime run, and follow delivery/reply performance from one place."
        actions={
          <>
            <Link
              className={actionButtonClass("secondary")}
              href="/dashboard/broadcasts"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to broadcasts
            </Link>
            <Link
              className={actionButtonClass("secondary")}
              href={`/dashboard/broadcasts/${campaign.id}/progress`}
            >
              <RadioTower className="mr-2 h-4 w-4" />
              View launch run
            </Link>
          </>
        }
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail={`${percent(campaign.deliveredCount, campaign.totalContacts)} delivery rate`}
          icon={CheckCheck}
          label="Delivered"
          value={formatNumber(campaign.deliveredCount)}
        />
        <MetricCard
          detail={`${percent(campaign.readCount, campaign.totalContacts)} read rate`}
          icon={Eye}
          label="Read"
          value={formatNumber(campaign.readCount)}
        />
        <MetricCard
          detail={`${formatNumber(campaign._count.conversionEvents)} conversion event(s)`}
          icon={MessageSquareReply}
          label="Replies"
          value={formatNumber(campaign._count.replyAttributions)}
        />
        <MetricCard
          detail={latestRun ? formatMoneyPaise(latestRun.estimatedCostPaise) : "No launch run yet"}
          icon={Users}
          label="Recipients"
          value={formatNumber(campaign.totalContacts)}
        />
      </section>

      <section className="mb-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <PanelTitle
              title="Launch controls"
              description="Active campaign launches can be canceled. Scheduled broadcasts can be paused or resumed before they become a launch run from the broadcasts list."
            />
            <StatusPill tone={statusTone(campaign.status)}>
              {campaign.status.replaceAll("_", " ")}
            </StatusPill>
          </div>

          <div className="mt-5 grid gap-3 rounded-2xl border border-[#BFE9D0] bg-[#F7FBFF] p-4 text-sm text-[#526173]">
            <div className="flex items-center justify-between gap-3">
              <span>Template</span>
              <span className="font-semibold text-[#081B3A]">
                {campaign.template?.name ?? "Unknown"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Language</span>
              <span className="font-semibold text-[#081B3A]">
                {campaign.template?.language ?? "Not set"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Category</span>
              <span className="font-semibold text-[#081B3A]">
                {campaign.template?.category ?? "Not set"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Created</span>
              <span className="font-semibold text-[#081B3A]">
                {formatDateTime(campaign.createdAt)}
              </span>
            </div>
          </div>

          <div className="mt-5">
            <BroadcastCampaignActions
              campaignId={campaign.id}
              canCancel={canCancelRun}
            />
          </div>
        </Panel>

        <Panel>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <PanelTitle
              title="Latest launch run"
              description="The runtime run reserves wallet, queues recipients, creates messages, and captures exact failure reasons."
            />
            <StatusPill tone={statusTone(latestRun?.status ?? "DRAFT")}>
              {latestRun?.status.replaceAll("_", " ") ?? "No run"}
            </StatusPill>
          </div>

          {latestRun ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["Launch run", latestRun.id],
                ["Created", formatDateTime(latestRun.createdAt)],
                ["Queued messages", formatNumber(latestRun.queuedMessageCount)],
                ["Created messages", formatNumber(latestRun.createdMessageCount)],
                ["Skipped", formatNumber(latestRun.skippedRecipients)],
                ["Reserved wallet", formatMoneyPaise(latestRun.reservedAmountPaise)],
              ].map(([label, value]) => (
                <div
                  className="rounded-2xl border border-[#BFE9D0] bg-[#F7FBFF] p-4"
                  key={label}
                >
                  <p className="text-xs font-semibold uppercase text-[#128C7E]">
                    {label}
                  </p>
                  <p className="mt-2 break-all text-sm font-semibold text-[#081B3A]">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-[#BFE9D0] bg-[#F7FBFF] p-6 text-sm text-[#526173]">
              No launch run has been created for this broadcast yet.
            </div>
          )}
        </Panel>
      </section>

      <Panel className="mb-6">
        <PanelTitle
          title="Recipient runtime status"
          description="Track how the latest launch run is moving from planned recipients to queued or failed work."
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { icon: Clock, label: "Planned", value: planned },
            { icon: Send, label: "Queued", value: queued },
            { icon: CheckCheck, label: "Message created", value: created },
            { icon: AlertTriangle, label: "Failed", value: failed },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <div
                className="rounded-2xl border border-[#BFE9D0] bg-[#F7FBFF] p-4"
                key={item.label}
              >
                <Icon className="h-5 w-5 text-[#128C7E]" />
                <p className="mt-4 text-2xl font-bold text-[#081B3A]">
                  {formatNumber(item.value)}
                </p>
                <p className="text-sm text-[#526173]">{item.label}</p>
              </div>
            );
          })}
        </div>
      </Panel>

      <section className="mb-6 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <PanelTitle
              title="Campaign report"
              description="Generate the completion report after queued/sending work settles, then export recipient-level CSV for accounting and follow-up."
            />
            <BroadcastReportActions
              campaignId={campaign.id}
              latestReportId={latestReport?.id ?? null}
            />
          </div>

          {latestReport ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["Report status", latestReport.status],
                ["Generated", formatDateTime(latestReport.generatedAt)],
                ["Total messages", formatNumber(latestReport.totalMessages)],
                ["Failed", formatNumber(latestReport.failedMessages)],
                [
                  "Actual cost",
                  formatMoneyPaise(latestReport.actualCostPaise),
                ],
                ["Replies", formatNumber(latestReport.replyCount)],
              ].map(([label, value]) => (
                <div
                  className="rounded-2xl border border-[#BFE9D0] bg-[#F7FBFF] p-4"
                  key={label}
                >
                  <p className="text-xs font-semibold uppercase text-[#128C7E]">
                    {label}
                  </p>
                  <p className="mt-2 break-all text-sm font-semibold text-[#081B3A]">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-[#BFE9D0] bg-[#F7FBFF] p-6 text-sm leading-6 text-[#526173]">
              No completion report has been generated yet. Generate it once
              delivery statuses have finished updating.
            </div>
          )}
        </Panel>

        <div className="[&>section]:mt-0 [&>section]:h-full [&>section]:border-[#BFE9D0] [&>section]:shadow-[0_18px_42px_rgba(8,27,58,0.06)]">
          <CampaignRetargetingCard
            campaignId={campaign.id}
            canManage={canManage}
          />
        </div>
      </section>

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <PanelTitle
            title="Recent failed recipients"
            description="Use these failure reasons to clean audience quality before retrying failed recipients."
          />
          <Link
            className={actionButtonClass("secondary")}
            href="/dashboard/broadcasts/failures"
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Failure workspace
          </Link>
        </div>

        {recentFailures.length > 0 ? (
          <div className="mt-5 overflow-hidden rounded-2xl border border-[#BFE9D0]">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[#E7F8EF] text-xs uppercase text-[#128C7E]">
                <tr>
                  <th className="px-4 py-3">Recipient</th>
                  <th className="px-4 py-3">Failure</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#BFE9D0] bg-white">
                {recentFailures.map((failure) => (
                  <tr key={failure.id}>
                    <td className="px-4 py-3 font-semibold text-[#081B3A]">
                      {failure.phoneMasked}
                    </td>
                    <td className="px-4 py-3 text-[#526173]">
                      {failure.failureReason ?? "Unknown failure"}
                    </td>
                    <td className="px-4 py-3 text-[#526173]">
                      {formatDateTime(failure.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-[#BFE9D0] bg-[#F7FBFF] p-8 text-center text-sm text-[#526173]">
            No failed recipients in the latest launch run.
          </div>
        )}
      </Panel>
    </div>
  );
}
