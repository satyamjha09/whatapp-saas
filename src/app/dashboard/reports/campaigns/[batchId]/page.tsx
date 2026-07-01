import {
  CheckCheck,
  CircleX,
  Clock3,
  Eye,
  Send,
  SendHorizontal,
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
import { getCampaignReportDetail } from "@/server/services/campaign-report.service";

export default async function CampaignReportDetailPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const report = await getCampaignReportDetail(
    context.membership.companyId,
    batchId,
  );

  if (!report) notFound();

  const { batch, summary, recipients } = report;

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Campaign Delivery Report"
        description={`Template: ${batch.templateName ?? "Deleted template"}. Source: ${batch.contactGroupName ?? "CSV / Manual"}. Delivery ${report.deliveryRate}%, read ${report.readRate}%, failure ${report.failureRate}%.`}
        actions={
          <>
            <Link
              href={`/dashboard/campaigns/${batch.id}`}
              className={actionButtonClass("secondary")}
            >
              Campaign Details
            </Link>
            <Link
              href="/dashboard/reports/campaigns"
              className={actionButtonClass()}
            >
              Back to Reports
            </Link>
          </>
        }
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          icon={SendHorizontal}
          label="Queued"
          value={batch.queuedCount}
        />
        <MetricCard icon={Clock3} label="Pending" value={summary.pending} />
        <MetricCard icon={Send} label="Sent" value={summary.sent} />
        <MetricCard icon={CheckCheck} label="Delivered" value={summary.delivered} />
        <MetricCard icon={Eye} label="Read" value={summary.read} />
        <MetricCard icon={CircleX} label="Failed" value={summary.failed} />
      </section>

      <Panel className="overflow-hidden p-0 sm:p-0">
        <div className="border-b border-[#BFE9D0] px-5 py-4 sm:px-6">
          <PanelTitle
            title="Recipient delivery status"
            description={`${recipients.length} stored recipient record${recipients.length === 1 ? "" : "s"}; ${summary.canceled} canceled.`}
          />
        </div>

        {recipients.length === 0 ? (
          <div className="p-5 sm:p-6">
            <EmptyState>No recipients found for this campaign.</EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-[#E7F8EF] text-xs uppercase text-[#526173]">
                <tr>
                  <th className="px-5 py-3">Phone</th>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Message Status</th>
                  <th className="px-5 py-3">Meta Message ID</th>
                  <th className="px-5 py-3">Batch Status</th>
                  <th className="px-5 py-3">Error</th>
                  <th className="px-5 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#BFE9D0]">
                {recipients.map((recipient) => {
                  const messageStatus = recipient.messageStatus ?? "NOT_CREATED";

                  return (
                    <tr key={recipient.id}>
                      <td className="px-5 py-4 font-semibold text-[#081B3A]">
                        +{recipient.countryCode} {recipient.phoneNumber}
                      </td>
                      <td className="px-5 py-4">
                        {recipient.name ?? "Unnamed contact"}
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill tone={statusTone(messageStatus)}>
                          {messageStatus}
                        </StatusPill>
                      </td>
                      <td className="max-w-xs break-all px-5 py-4 font-mono text-xs text-[#526173]">
                        {recipient.metaMessageId ?? "—"}
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill
                          tone={statusTone(recipient.batchRecipientStatus)}
                        >
                          {recipient.batchRecipientStatus}
                        </StatusPill>
                      </td>
                      <td className="max-w-xs px-5 py-4 text-rose-700">
                        {recipient.errorMessage ?? "—"}
                      </td>
                      <td className="px-5 py-4 text-[#526173]">
                        {recipient.updatedAt.toLocaleString()}
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
