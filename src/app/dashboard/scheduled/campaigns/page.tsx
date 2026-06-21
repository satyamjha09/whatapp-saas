import { CalendarClock, Send } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  EmptyState,
  PageHeader,
  Panel,
  PanelTitle,
  StatusPill,
  actionButtonClass,
} from "@/app/dashboard/dashboard-ui";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import CancelScheduledCampaignButton from "@/app/dashboard/campaigns/cancel-scheduled-campaign-button";

export default async function ScheduledCampaignsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const canManage =
    context.membership.role === "OWNER" ||
    context.membership.role === "ADMIN";

  const campaigns = await prisma.bulkMessageBatch.findMany({
    where: {
      companyId: context.membership.companyId,
      status: "SCHEDULED",
      scheduledAt: { not: null },
    },
    orderBy: { scheduledAt: "asc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Scheduled Campaigns"
        description="Upcoming bulk WhatsApp campaigns waiting for their scheduled send time."
        actions={
          <Link href="/dashboard/messages/bulk" className={actionButtonClass()}>
            <Send className="mr-2 h-4 w-4" />
            Schedule New Campaign
          </Link>
        }
      />

      <Panel className="overflow-hidden p-0 sm:p-0">
        <div className="border-b border-[#D8E6F3] px-5 py-4 sm:px-6">
          <PanelTitle
            title="Upcoming campaigns"
            description={`${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"} scheduled.`}
          />
        </div>

        {campaigns.length === 0 ? (
          <div className="p-5 sm:p-6">
            <EmptyState>No scheduled campaigns yet.</EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-[#F0F8FF] text-xs uppercase text-[#526173]">
                <tr>
                  <th className="px-5 py-3">Template</th>
                  <th className="px-5 py-3">Scheduled For</th>
                  <th className="px-5 py-3">Recipients</th>
                  <th className="px-5 py-3">Duplicates</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8E6F3]">
                {campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td className="px-5 py-4 font-semibold text-[#081B3A]">
                      {campaign.templateName ?? "—"}
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill tone="blue">
                        <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                        {campaign.scheduledAt?.toLocaleString()}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-4">{campaign.queuedCount}</td>
                    <td className="px-5 py-4">
                      {campaign.skippedDuplicateCount}
                    </td>
                    <td className="px-5 py-4 text-[#526173]">
                      {campaign.createdAt.toLocaleString()}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <Link
                          href={`/dashboard/campaigns/${campaign.id}`}
                          className="font-semibold text-[#0052CC] hover:underline"
                        >
                          View
                        </Link>
                        {canManage ? (
                          <CancelScheduledCampaignButton
                            batchId={campaign.id}
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
