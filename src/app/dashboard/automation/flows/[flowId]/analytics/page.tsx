import {
  AlertTriangle,
  BarChart3,
  Clock3,
  GitBranch,
  Hourglass,
  MousePointerClick,
  ShieldCheck,
  Users,
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
  fieldClass,
  labelClass,
  statusTone,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { checkUserAutomationPermission } from "@/server/services/automation-permission.service";
import { getFlowAnalytics } from "@/server/services/automation-analytics.service";
import { getCompanyPlanFeatures } from "@/server/services/plan-feature.service";
import { automationFlowAnalyticsQuerySchema } from "@/server/validators/automation-analytics.validator";
import UpgradeRequiredBanner from "@/components/automation-builder/upgrade-required-banner";

type FlowAnalyticsPageProps = {
  params: Promise<{
    flowId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeSearchParams(
  params: Record<string, string | string[] | undefined> | undefined,
) {
  return Object.fromEntries(
    Object.entries(params ?? {})
      .map(([key, value]) => [key, firstValue(value)])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

function formatDuration(durationMs: number) {
  if (durationMs <= 0) return "-";
  if (durationMs < 1000) return `${durationMs}ms`;

  return `${(durationMs / 1000).toFixed(1)}s`;
}

function formatPercent(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function dateInputValue(value: string | undefined) {
  if (!value) return "";
  return value.slice(0, 10);
}

export default async function FlowAnalyticsPage({
  params,
  searchParams,
}: FlowAnalyticsPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const canViewAnalytics = await checkUserAutomationPermission(
    context.membership.companyId,
    context.user.id,
    "automation.analytics.view",
  );
  if (!canViewAnalytics) redirect("/dashboard");

  const { flowId } = await params;
  const rawFilters = normalizeSearchParams(await searchParams);
  const parsedFilters = automationFlowAnalyticsQuerySchema.safeParse(rawFilters);
  const filters = parsedFilters.success
    ? parsedFilters.data
    : automationFlowAnalyticsQuerySchema.parse({});
  const analytics = await getFlowAnalytics(
    context.membership.companyId,
    flowId,
    filters,
  );
  const planFeatures = await getCompanyPlanFeatures(context.membership.companyId);

  if (!analytics) notFound();

  if (!planFeatures.advancedAnalytics) {
    analytics.nodeAnalytics = [];
    analytics.dropOffNodes = [];
    analytics.topFailedNodes = [];
    analytics.topTriggerKeywords = [];
    analytics.versionBreakdown = [];
  }

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title={`${analytics.flow.name} Analytics`}
        description="Track runs, failures, waiting sessions, node performance, drop-offs, and version results for this automation flow."
        actions={
          <>
            <Link
              href={`/automation/builder/${flowId}`}
              className={actionButtonClass("secondary")}
            >
              View Builder
            </Link>
            <Link
              href={`/dashboard/automation/executions?flowId=${flowId}`}
              className={actionButtonClass()}
            >
              View Executions
            </Link>
          </>
        }
      />

      <Panel className="mb-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <PanelTitle
            title="Analytics filters"
            description={`Showing ${new Date(analytics.dateRange.startDate).toLocaleDateString()} to ${new Date(analytics.dateRange.endDate).toLocaleDateString()}.`}
          />
          <StatusPill tone={statusTone(analytics.flow.status)}>
            {analytics.flow.status}
          </StatusPill>
        </div>

        <form className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label>
            <span className={labelClass}>Range</span>
            <select className={fieldClass} name="range" defaultValue={rawFilters.range ?? "30d"}>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="custom">Custom</option>
            </select>
          </label>

          <label>
            <span className={labelClass}>Version</span>
            <select
              className={fieldClass}
              name="flowVersionId"
              defaultValue={rawFilters.flowVersionId ?? ""}
            >
              <option value="">All versions</option>
              {analytics.versions.map((version) => (
                <option key={version.id} value={version.id}>
                  v{version.versionNumber}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className={labelClass}>From</span>
            <input
              className={fieldClass}
              name="startDate"
              type="date"
              defaultValue={dateInputValue(rawFilters.startDate)}
            />
          </label>

          <label>
            <span className={labelClass}>To</span>
            <input
              className={fieldClass}
              name="endDate"
              type="date"
              defaultValue={dateInputValue(rawFilters.endDate)}
            />
          </label>

          <div className="flex items-end gap-3">
            <button className={actionButtonClass()} type="submit">
              Apply
            </button>
            <Link
              href={`/dashboard/automation/flows/${flowId}/analytics`}
              className={actionButtonClass("secondary")}
            >
              Reset
            </Link>
          </div>
        </form>
      </Panel>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={BarChart3}
          label="Total runs"
          value={analytics.summary.totalRuns.toLocaleString("en-IN")}
          detail={`${formatPercent(analytics.summary.successRate)} success rate`}
        />
        <MetricCard
          icon={ShieldCheck}
          label="Successful runs"
          value={analytics.summary.successfulRuns.toLocaleString("en-IN")}
        />
        <MetricCard
          icon={AlertTriangle}
          label="Failed runs"
          value={analytics.summary.failedRuns.toLocaleString("en-IN")}
          detail={`${formatPercent(analytics.summary.failureRate)} failure rate`}
        />
        <MetricCard
          icon={Hourglass}
          label="Waiting sessions"
          value={analytics.summary.waitingSessions.toLocaleString("en-IN")}
          detail={`${analytics.summary.waitingRuns.toLocaleString("en-IN")} waiting executions`}
        />
        <MetricCard
          icon={Users}
          label="Completed sessions"
          value={analytics.summary.completedSessions.toLocaleString("en-IN")}
        />
        <MetricCard
          icon={Clock3}
          label="Average execution time"
          value={formatDuration(analytics.summary.averageExecutionTimeMs)}
        />
        <MetricCard
          icon={MousePointerClick}
          label="Human handoffs"
          value={analytics.summary.humanHandoffCount.toLocaleString("en-IN")}
        />
        <MetricCard
          icon={GitBranch}
          label="Payment links created"
          value={analytics.summary.paymentLinkCreatedCount.toLocaleString("en-IN")}
        />
      </section>

      {!planFeatures.advancedAnalytics ? (
        <div className="mb-6">
          <UpgradeRequiredBanner
            title="Advanced analytics locked"
            message="Node-wise analytics, drop-off nodes, failed-node trends, trigger keywords, and version breakdown require the Pro plan or higher."
            requiredPlan="PRO"
          />
        </div>
      ) : null}

      <Panel className="mb-6 overflow-hidden p-0 sm:p-0">
        <div className="border-b border-[#BFE9D0] px-5 py-4 sm:px-6">
          <PanelTitle
            title="Node performance"
            description="Visits, outcomes, drop-off rate, average duration, and most common error by node."
          />
        </div>

        {analytics.nodeAnalytics.length === 0 ? (
          <div className="p-5 sm:p-6">
            <EmptyState>
              No node execution data yet. Publish this flow and trigger it from
              WhatsApp to populate analytics.
            </EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1160px] text-left text-sm">
              <thead className="bg-[#E7F8EF] text-xs uppercase text-[#526173]">
                <tr>
                  <th className="px-5 py-3">Node</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Visits</th>
                  <th className="px-5 py-3">Success</th>
                  <th className="px-5 py-3">Failed</th>
                  <th className="px-5 py-3">Waiting</th>
                  <th className="px-5 py-3">Drop-off</th>
                  <th className="px-5 py-3">Avg duration</th>
                  <th className="px-5 py-3">Most common error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#BFE9D0]">
                {analytics.nodeAnalytics.map((node) => (
                  <tr key={`${node.nodeId}:${node.nodeType}`}>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-[#081B3A]">
                        {node.nodeLabel ?? node.nodeId}
                      </p>
                      <p className="mt-1 font-mono text-xs text-[#526173]">
                        {node.nodeId}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-[#526173]">{node.nodeType}</td>
                    <td className="px-5 py-4">{node.totalVisits}</td>
                    <td className="px-5 py-4 text-emerald-700">
                      {node.successCount}
                    </td>
                    <td className="px-5 py-4 text-rose-700">
                      {node.failedCount}
                    </td>
                    <td className="px-5 py-4 text-amber-700">
                      {node.waitingCount}
                    </td>
                    <td className="px-5 py-4">
                      {node.dropOffCount} ({formatPercent(node.dropOffRate)})
                    </td>
                    <td className="px-5 py-4">
                      {formatDuration(node.averageDurationMs)}
                    </td>
                    <td className="max-w-sm px-5 py-4 text-[#526173]">
                      <p className="line-clamp-2">
                        {node.mostCommonError ?? "-"}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <section className="mb-6 grid gap-5 xl:grid-cols-2">
        <Panel>
          <PanelTitle
            title="Top drop-off nodes"
            description="Nodes where users failed, waited, or were handed off."
          />
          {analytics.dropOffNodes.length === 0 ? (
            <div className="mt-5">
              <EmptyState>No drop-off nodes in this period.</EmptyState>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {analytics.dropOffNodes.map((node) => (
                <div
                  key={`${node.nodeId}:${node.nodeType}`}
                  className="rounded-xl border border-[#BFE9D0] bg-[#F7FFFA] p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[#081B3A]">
                        {node.nodeLabel ?? node.nodeId}
                      </p>
                      <p className="mt-1 text-xs text-[#526173]">
                        {node.nodeType} · {node.nodeId}
                      </p>
                    </div>
                    <StatusPill tone="amber">
                      {node.dropOffCount} drop-offs
                    </StatusPill>
                  </div>
                  <p className="mt-3 text-sm text-[#526173]">
                    Drop-off rate: {formatPercent(node.dropOffRate)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <PanelTitle
            title="Top failed nodes"
            description="Most frequent failure points and their common error."
          />
          {analytics.topFailedNodes.length === 0 ? (
            <div className="mt-5">
              <EmptyState>No failed nodes in this period.</EmptyState>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {analytics.topFailedNodes.map((node) => (
                <div
                  key={`${node.nodeId}:${node.nodeType}`}
                  className="rounded-xl border border-rose-200 bg-rose-50 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[#081B3A]">
                        {node.nodeLabel ?? node.nodeId}
                      </p>
                      <p className="mt-1 text-xs text-[#526173]">
                        {node.nodeType} · {node.nodeId}
                      </p>
                    </div>
                    <StatusPill tone="red">{node.failedCount} failed</StatusPill>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-rose-700">
                    {node.lastError ?? "No error message recorded."}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel>
          <PanelTitle
            title="Top trigger keywords"
            description="Normalized incoming trigger text by success and failure."
          />
          {analytics.topTriggerKeywords.length === 0 ? (
            <div className="mt-5">
              <EmptyState>No trigger keywords in this period.</EmptyState>
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-[#E7F8EF] text-xs uppercase text-[#526173]">
                  <tr>
                    <th className="px-4 py-3">Keyword</th>
                    <th className="px-4 py-3">Runs</th>
                    <th className="px-4 py-3">Success</th>
                    <th className="px-4 py-3">Failed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#BFE9D0]">
                  {analytics.topTriggerKeywords.map((keyword) => (
                    <tr key={keyword.keyword}>
                      <td className="px-4 py-3 font-semibold text-[#081B3A]">
                        {keyword.keyword}
                      </td>
                      <td className="px-4 py-3">{keyword.count}</td>
                      <td className="px-4 py-3 text-emerald-700">
                        {keyword.successCount}
                      </td>
                      <td className="px-4 py-3 text-rose-700">
                        {keyword.failedCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel>
          <PanelTitle
            title="Version breakdown"
            description="Compare published versions using the execution version snapshot."
          />
          {analytics.versionBreakdown.length === 0 ? (
            <div className="mt-5">
              <EmptyState>No version execution data in this period.</EmptyState>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {analytics.versionBreakdown.map((version) => (
                <div
                  key={version.flowVersionId}
                  className="rounded-xl border border-[#BFE9D0] bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[#081B3A]">
                        Version {version.versionNumber}
                      </p>
                      <p className="mt-1 text-xs text-[#526173]">
                        Published{" "}
                        {version.publishedAt
                          ? new Date(version.publishedAt).toLocaleString()
                          : "-"}
                      </p>
                    </div>
                    <StatusPill tone="green">
                      {formatPercent(version.successRate)}
                    </StatusPill>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-[#526173]">Runs</p>
                      <p className="font-bold text-[#081B3A]">
                        {version.totalRuns}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#526173]">Success</p>
                      <p className="font-bold text-emerald-700">
                        {version.successfulRuns}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#526173]">Failed</p>
                      <p className="font-bold text-rose-700">
                        {version.failedRuns}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}
