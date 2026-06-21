import { BarChart3, CheckCheck, CircleX, Send } from "lucide-react";
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
import { getCampaignReportsByCompany } from "@/server/services/campaign-report.service";

export default async function CampaignReportsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const reports = await getCampaignReportsByCompany(
    context.membership.companyId,
  );
  const totals = reports.reduce(
    (total, report) => ({
      campaigns: total.campaigns + 1,
      queued: total.queued + report.queuedCount,
      deliveredOrRead:
        total.deliveredOrRead +
        report.summary.delivered +
        report.summary.read,
      failed: total.failed + report.summary.failed,
    }),
    { campaigns: 0, queued: 0, deliveredOrRead: 0, failed: 0 },
  );

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Campaign Reports"
        description="Delivery, read, failure, cancellation, and pending-message reporting for bulk campaigns."
        actions={
          <>
            <Link href="/dashboard/messages/bulk" className={actionButtonClass()}>
              <Send className="mr-2 h-4 w-4" />
              New Bulk Message
            </Link>
            <Link
              href="/dashboard/campaigns"
              className={actionButtonClass("secondary")}
            >
              Campaign History
            </Link>
          </>
        }
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={BarChart3}
          label="Campaigns"
          value={totals.campaigns.toLocaleString("en-IN")}
          detail="Latest 100 bulk campaigns"
        />
        <MetricCard
          icon={Send}
          label="Queued Messages"
          value={totals.queued.toLocaleString("en-IN")}
        />
        <MetricCard
          icon={CheckCheck}
          label="Delivered / Read"
          value={totals.deliveredOrRead.toLocaleString("en-IN")}
        />
        <MetricCard
          icon={CircleX}
          label="Failed"
          value={totals.failed.toLocaleString("en-IN")}
        />
      </section>

      <Panel className="overflow-hidden p-0 sm:p-0">
        <div className="border-b border-[#D8E6F3] px-5 py-4 sm:px-6">
          <PanelTitle
            title="Campaign delivery summary"
            description="Current message status and outcome rates for each tracked bulk batch."
          />
        </div>

        {reports.length === 0 ? (
          <div className="p-5 sm:p-6">
            <EmptyState>No campaign reports yet.</EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="bg-[#F0F8FF] text-xs uppercase text-[#526173]">
                <tr>
                  <th className="px-5 py-3">Template</th>
                  <th className="px-5 py-3">Group</th>
                  <th className="px-5 py-3">Campaign</th>
                  <th className="px-5 py-3">Queued</th>
                  <th className="px-5 py-3">Pending</th>
                  <th className="px-5 py-3">Sent</th>
                  <th className="px-5 py-3">Delivered</th>
                  <th className="px-5 py-3">Read</th>
                  <th className="px-5 py-3">Failed</th>
                  <th className="px-5 py-3">Canceled</th>
                  <th className="px-5 py-3">Delivery</th>
                  <th className="px-5 py-3">Read rate</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8E6F3]">
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td className="px-5 py-4 font-semibold text-[#081B3A]">
                      {report.templateName ?? "—"}
                    </td>
                    <td className="px-5 py-4 text-[#526173]">
                      {report.contactGroupName ?? "CSV / Manual"}
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill tone={statusTone(report.status)}>
                        {report.status}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-4">{report.queuedCount}</td>
                    <td className="px-5 py-4">{report.summary.pending}</td>
                    <td className="px-5 py-4">{report.summary.sent}</td>
                    <td className="px-5 py-4">{report.summary.delivered}</td>
                    <td className="px-5 py-4">{report.summary.read}</td>
                    <td className="px-5 py-4">{report.summary.failed}</td>
                    <td className="px-5 py-4">{report.summary.canceled}</td>
                    <td className="px-5 py-4 font-semibold text-[#081B3A]">
                      {report.deliveryRate}%
                    </td>
                    <td className="px-5 py-4 font-semibold text-[#081B3A]">
                      {report.readRate}%
                    </td>
                    <td className="px-5 py-4 text-[#526173]">
                      {report.createdAt.toLocaleString()}
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/dashboard/reports/campaigns/${report.id}`}
                        className="font-semibold text-[#0052CC] hover:underline"
                      >
                        Report
                      </Link>
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
