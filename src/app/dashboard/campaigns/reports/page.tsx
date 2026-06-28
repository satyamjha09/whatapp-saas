import { requireAdmin } from "@/server/auth/authorization";
import { getCampaignCompletionReportDashboard } from "@/server/services/campaign-completion-report.service";
import {
  DownloadCampaignReportButton,
  GenerateCampaignReportButton,
} from "./report-actions";

function money(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    style: "currency",
  }).format(paise / 100);
}

function rate(value: unknown) {
  const number = Number(value ?? 0);

  return `${number.toFixed(2)}%`;
}

export default async function CampaignReportsPage() {
  const context = await requireAdmin();
  const dashboard = await getCampaignCompletionReportDashboard({
    companyId: context.membership.companyId,
  });
  const totalMessages = dashboard.reports.reduce(
    (sum, report) => sum + report.totalMessages,
    0,
  );
  const totalCost = dashboard.reports.reduce(
    (sum, report) => sum + report.actualCostPaise,
    0,
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">Campaigns</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">
            Campaign Reports
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Final campaign summaries with delivery, read, failure, cost, replies, opt-outs, and CSV evidence.
          </p>
        </div>
        <GenerateCampaignReportButton />
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Reports</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {dashboard.reports.length}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Messages</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {totalMessages}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Cost</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {money(totalCost)}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Generated / 24h</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {dashboard.generated24h}
          </p>
        </div>
      </section>

      <section className="mt-6 space-y-4">
        {dashboard.reports.map((report) => (
          <article
            key={report.id}
            className="rounded-2xl border bg-white p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-gray-500">
                  {report.campaignId}
                </p>
                <h2 className="mt-2 text-lg font-semibold text-gray-900">
                  Final Campaign Report
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Generated {report.generatedAt.toLocaleString()} by{" "}
                  {report.generatedByUser?.email ?? "system"}
                </p>
              </div>
              <DownloadCampaignReportButton reportId={report.id} />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-8">
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Total</p>
                <p className="font-bold">{report.totalMessages}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Sent</p>
                <p className="font-bold">{report.sentMessages}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Delivered</p>
                <p className="font-bold">{report.deliveredMessages}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Read</p>
                <p className="font-bold">{report.readMessages}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Failed</p>
                <p className="font-bold text-red-700">{report.failedMessages}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Replies</p>
                <p className="font-bold">{report.replyCount}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Opt-outs</p>
                <p className="font-bold">{report.optOutCount}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Cost</p>
                <p className="font-bold">{money(report.actualCostPaise)}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border p-4">
                <p className="text-xs text-gray-500">Delivery Rate</p>
                <p className="mt-1 text-xl font-bold">
                  {rate(report.deliveryRate)}
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs text-gray-500">Read Rate</p>
                <p className="mt-1 text-xl font-bold">
                  {rate(report.readRate)}
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs text-gray-500">Failure Rate</p>
                <p className="mt-1 text-xl font-bold">
                  {rate(report.failureRate)}
                </p>
              </div>
            </div>

            {report.criticalFailureCount > 0 ? (
              <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
                {report.criticalFailureCount} critical failure group(s) found.
                Open Failure Intelligence to review fixes before retrying.
              </div>
            ) : null}
          </article>
        ))}

        {dashboard.reports.length === 0 ? (
          <div className="rounded-2xl border bg-white p-8 text-center text-sm text-gray-500">
            No campaign reports yet.
          </div>
        ) : null}
      </section>
    </main>
  );
}
