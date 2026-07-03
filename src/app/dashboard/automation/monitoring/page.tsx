import {
  Activity,
  AlertTriangle,
  Clock3,
  GitBranch,
  ListChecks,
  Server,
} from "lucide-react";
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
  fieldClass,
  statusTone,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { checkUserAutomationPermission } from "@/server/services/automation-permission.service";
import { getMonitoringOverview } from "@/server/services/automation-monitoring.service";
import { monitoringOverviewQuerySchema } from "@/server/validators/automation-alert.validator";
import { RunMonitoringChecksButton } from "./run-monitoring-checks-button";

type MonitoringPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatPercent(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

function formatAge(ms?: number) {
  if (!ms) return "-";
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 60 * 60_000) return `${Math.round(ms / 60_000)}m`;
  return `${Math.round(ms / (60 * 60_000))}h`;
}

export default async function AutomationMonitoringPage({
  searchParams,
}: MonitoringPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const [canView, canRunChecks] = await Promise.all([
    checkUserAutomationPermission(
      context.membership.companyId,
      context.user.id,
      "automation.monitoring.view",
    ),
    checkUserAutomationPermission(
      context.membership.companyId,
      context.user.id,
      "automation.monitoring.run_checks",
    ),
  ]);

  if (!canView) redirect("/dashboard");

  const rawParams = await searchParams;
  const parsed = monitoringOverviewQuerySchema.safeParse({
    range: firstValue(rawParams?.range),
  });
  const filters = parsed.success
    ? parsed.data
    : monitoringOverviewQuerySchema.parse({});
  const overview = await getMonitoringOverview(
    context.membership.companyId,
    filters,
  );

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Automation Monitoring"
        description="Track automation failures, stuck queues, unhealthy workers, integration issues, and production alert trends."
        actions={
          <>
            <Link
              className={actionButtonClass("secondary")}
              href="/dashboard/automation/alerts"
            >
              View alerts
            </Link>
            {canRunChecks ? <RunMonitoringChecksButton /> : null}
          </>
        }
      />

      <Panel className="mb-6">
        <form className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <PanelTitle
              title="Health status"
              description="Monitoring uses existing execution logs and queue state. It never sends customer messages or debits wallet."
            />
            <div className="mt-3">
              <StatusPill tone={statusTone(overview.healthStatus)}>
                {overview.healthStatus}
              </StatusPill>
            </div>
          </div>
          <label className="w-full sm:w-48">
            <span className="mb-2 block text-sm font-medium text-[#102040]">
              Range
            </span>
            <select className={fieldClass} defaultValue={filters.range} name="range">
              <option value="1h">Last hour</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </label>
          <button className={actionButtonClass("primary")} type="submit">
            Apply
          </button>
        </form>
      </Panel>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          icon={AlertTriangle}
          label="Open alerts"
          value={overview.summary.openAlerts}
          detail={`${overview.summary.criticalAlerts} critical`}
        />
        <MetricCard
          icon={Activity}
          label="Failed executions"
          value={overview.summary.failedExecutionsLast24h}
          detail="Last 24 hours"
        />
        <MetricCard
          icon={ListChecks}
          label="Failure rate"
          value={formatPercent(overview.summary.failureRateLast24h)}
          detail="Last 24 hours"
        />
        <MetricCard
          icon={Server}
          label="Queue issues"
          value={overview.summary.queueIssues}
        />
        <MetricCard
          icon={GitBranch}
          label="Integration issues"
          value={overview.summary.integrationIssues}
        />
        <MetricCard
          icon={Clock3}
          label="Plan limit issues"
          value={overview.summary.planLimitIssues}
        />
      </section>

      <section className="mb-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <Panel>
          <PanelTitle
            title="Queue Health"
            description="BullMQ counts plus oldest waiting/delayed job age."
          />
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#D7F1E2] text-xs uppercase text-[#526173]">
                <tr>
                  <th className="py-3 pr-4">Queue</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Waiting</th>
                  <th className="py-3 pr-4">Active</th>
                  <th className="py-3 pr-4">Delayed</th>
                  <th className="py-3 pr-4">Failed</th>
                  <th className="py-3">Oldest</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7F8EF]">
                {overview.queues.map((queue) => (
                  <tr key={queue.queueName}>
                    <td className="py-3 pr-4 font-semibold text-[#081B3A]">
                      {queue.queueName}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusPill tone={statusTone(queue.status)}>
                        {queue.status}
                      </StatusPill>
                    </td>
                    <td className="py-3 pr-4">{queue.waiting}</td>
                    <td className="py-3 pr-4">{queue.active}</td>
                    <td className="py-3 pr-4">{queue.delayed}</td>
                    <td className="py-3 pr-4">{queue.failed}</td>
                    <td className="py-3">{formatAge(queue.oldestJobAgeMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <PanelTitle
            title="Recent Alerts"
            description="Newest open, acknowledged, resolved, or muted alerts."
          />
          <div className="mt-5 space-y-3">
            {overview.recentAlerts.length === 0 ? (
              <EmptyState>No automation alerts found.</EmptyState>
            ) : (
              overview.recentAlerts.map((alert) => (
                <Link
                  className="block rounded-xl border border-[#D7F1E2] p-4 transition hover:border-[#128C7E]/30 hover:bg-[#E7F8EF]"
                  href={`/dashboard/automation/alerts/${alert.id}`}
                  key={alert.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#081B3A]">{alert.title}</p>
                      <p className="mt-1 text-xs text-[#526173]">
                        Seen {alert.count} time(s)
                      </p>
                    </div>
                    <StatusPill tone={statusTone(alert.severity)}>
                      {alert.severity}
                    </StatusPill>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel>
          <PanelTitle title="Top Failing Flows" />
          <div className="mt-5 space-y-3">
            {overview.topFailingFlows.length === 0 ? (
              <EmptyState>No failed flows in this range.</EmptyState>
            ) : (
              overview.topFailingFlows.map((flow) => (
                <div
                  className="rounded-xl border border-[#D7F1E2] p-4"
                  key={flow.flowId}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#081B3A]">{flow.flowName}</p>
                      <p className="mt-1 text-sm text-[#526173]">
                        {flow.failedCount} failures · {formatPercent(flow.failureRate)}
                      </p>
                    </div>
                    <Link
                      className="text-sm font-semibold text-[#128C7E]"
                      href={`/dashboard/automation/flows/${flow.flowId}/analytics`}
                    >
                      Analytics
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <PanelTitle title="Top Failing Nodes" />
          <div className="mt-5 space-y-3">
            {overview.topFailingNodes.length === 0 ? (
              <EmptyState>No failed nodes in this range.</EmptyState>
            ) : (
              overview.topFailingNodes.map((node) => (
                <div
                  className="rounded-xl border border-[#D7F1E2] p-4"
                  key={`${node.flowId}:${node.nodeId}`}
                >
                  <p className="font-semibold text-[#081B3A]">{node.nodeType}</p>
                  <p className="mt-1 text-sm text-[#526173]">
                    {node.flowName} · {node.failedCount} failures
                  </p>
                  <Link
                    className="mt-2 inline-flex text-sm font-semibold text-[#128C7E]"
                    href={`/dashboard/automation/executions?flowId=${node.flowId}&status=FAILED`}
                  >
                    Open logs
                  </Link>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>
    </div>
  );
}
