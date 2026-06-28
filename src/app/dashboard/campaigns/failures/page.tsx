import { requireAdmin } from "@/server/auth/authorization";
import { getCampaignFailureDashboard } from "@/server/services/campaign-failure-intelligence.service";
import {
  AnalyzeCampaignFailuresButton,
  FailureInsightActions,
} from "./failure-actions";

function badgeClass(value: string) {
  if (value === "CRITICAL" || value === "DO_NOT_RETRY") {
    return "bg-red-50 text-red-700";
  }

  if (value === "WARNING" || value === "RETRY_AFTER_FIX") {
    return "bg-yellow-50 text-yellow-700";
  }

  if (value === "SAFE_TO_RETRY" || value === "INFO") {
    return "bg-green-50 text-green-700";
  }

  return "bg-gray-100 text-gray-700";
}

export default async function CampaignFailuresPage() {
  const context = await requireAdmin();
  const dashboard = await getCampaignFailureDashboard({
    companyId: context.membership.companyId,
  });
  const openCritical = dashboard.insights.filter(
    (insight) => insight.status === "OPEN" && insight.severity === "CRITICAL",
  ).length;
  const safeRetry = dashboard.insights.filter(
    (insight) =>
      insight.status === "OPEN" && insight.retrySafety === "SAFE_TO_RETRY",
  ).length;
  const failedMessages = dashboard.insights.reduce(
    (sum, insight) => sum + insight.failedMessageCount,
    0,
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">Campaigns</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">
            Failure Intelligence
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Understand failed WhatsApp messages, fix root causes, and safely retry retryable groups.
          </p>
        </div>
        <AnalyzeCampaignFailuresButton />
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Open Critical</p>
          <p className="mt-2 text-2xl font-bold text-red-700">{openCritical}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Safe Retry Groups</p>
          <p className="mt-2 text-2xl font-bold text-green-700">{safeRetry}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Failed Messages</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{failedMessages}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Analysis Runs</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {dashboard.runs.length}
          </p>
        </div>
      </section>

      <section className="mt-6 space-y-4">
        {dashboard.insights.map((insight) => (
          <article
            key={insight.id}
            className="rounded-2xl border bg-white p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(insight.severity)}`}
                  >
                    {insight.severity}
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                    {insight.category}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(insight.retrySafety)}`}
                  >
                    {insight.retrySafety}
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                    {insight.status}
                  </span>
                </div>
                <h2 className="mt-4 text-lg font-semibold text-gray-900">
                  {insight.failedMessageCount} failed message(s)
                </h2>
                <p className="mt-2 text-sm text-gray-600">{insight.suggestedFix}</p>
                {insight.sampleErrorMessage ? (
                  <pre className="mt-4 overflow-auto rounded-xl bg-gray-950 p-4 text-xs text-gray-100">
                    {insight.sampleErrorMessage}
                  </pre>
                ) : null}
                {insight.technicalDetails ? (
                  <p className="mt-3 text-xs text-gray-500">
                    {insight.technicalDetails}
                  </p>
                ) : null}
              </div>
              <FailureInsightActions
                insightId={insight.id}
                retrySafety={insight.retrySafety}
                status={insight.status}
              />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Error Code</p>
                <p className="mt-1 font-mono text-xs font-semibold">
                  {insight.errorCode ?? "-"}
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Retryable</p>
                <p className="mt-1 font-semibold">
                  {insight.retryableMessageCount}
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Last Seen</p>
                <p className="mt-1 text-xs font-semibold">
                  {insight.lastSeenAt?.toLocaleString() ?? "-"}
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Retry Batch</p>
                <p className="mt-1 font-mono text-xs font-semibold">
                  {insight.retryBatchId ?? "-"}
                </p>
              </div>
            </div>
          </article>
        ))}
        {dashboard.insights.length === 0 ? (
          <div className="rounded-2xl border bg-white p-8 text-center text-sm text-gray-500">
            No failure insights yet. Analyze a campaign to generate insights.
          </div>
        ) : null}
      </section>
    </main>
  );
}
