import { AlertTriangle, Bell, CheckCircle2, ShieldAlert } from "lucide-react";
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
import { listAlerts } from "@/server/services/automation-alert.service";
import { automationAlertListQuerySchema } from "@/server/validators/automation-alert.validator";

type AlertsPageProps = {
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

function buildPageHref(filters: Record<string, string>, page: number) {
  const params = new URLSearchParams(filters);
  params.set("page", String(page));

  return `/dashboard/automation/alerts?${params.toString()}`;
}

export default async function AutomationAlertsPage({
  searchParams,
}: AlertsPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const canView = await checkUserAutomationPermission(
    context.membership.companyId,
    context.user.id,
    "automation.alert.view",
  );
  if (!canView) redirect("/dashboard");

  const rawFilters = normalizeSearchParams(await searchParams);
  const parsed = automationAlertListQuerySchema.safeParse(rawFilters);
  const filters = parsed.success
    ? parsed.data
    : automationAlertListQuerySchema.parse({});
  const result = await listAlerts(context.membership.companyId, filters);

  const summary = result.alerts.reduce(
    (acc, alert) => {
      if (alert.status === "OPEN") acc.open += 1;
      if (alert.severity === "CRITICAL") acc.critical += 1;
      if (alert.severity === "WARNING") acc.warning += 1;
      if (alert.status === "RESOLVED") acc.resolved += 1;
      return acc;
    },
    { critical: 0, open: 0, resolved: 0, warning: 0 },
  );

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Automation Alerts"
        description="Review production automation alerts, repeated node failures, queue issues, and integration health problems."
        actions={
          <Link
            className={actionButtonClass("secondary")}
            href="/dashboard/automation/monitoring"
          >
            Monitoring
          </Link>
        }
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Bell} label="Open on page" value={summary.open} />
        <MetricCard
          icon={ShieldAlert}
          label="Critical on page"
          value={summary.critical}
        />
        <MetricCard
          icon={AlertTriangle}
          label="Warnings on page"
          value={summary.warning}
        />
        <MetricCard
          icon={CheckCircle2}
          label="Resolved on page"
          value={summary.resolved}
        />
      </section>

      <Panel className="mb-6">
        <PanelTitle
          title="Filters"
          description="Filter alerts by status, severity, type, or flow ID."
        />
        <form className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label>
            <span className="mb-2 block text-sm font-medium text-[#102040]">
              Status
            </span>
            <select className={fieldClass} defaultValue={rawFilters.status ?? ""} name="status">
              <option value="">All</option>
              {["OPEN", "ACKNOWLEDGED", "RESOLVED", "MUTED"].map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-2 block text-sm font-medium text-[#102040]">
              Severity
            </span>
            <select className={fieldClass} defaultValue={rawFilters.severity ?? ""} name="severity">
              <option value="">All</option>
              {["INFO", "WARNING", "CRITICAL"].map((severity) => (
                <option key={severity} value={severity}>
                  {severity}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-2 block text-sm font-medium text-[#102040]">
              Type
            </span>
            <input
              className={fieldClass}
              defaultValue={rawFilters.type ?? ""}
              name="type"
              placeholder="AUTOMATION_NODE_FAILURE_SPIKE"
            />
          </label>

          <label>
            <span className="mb-2 block text-sm font-medium text-[#102040]">
              Flow ID
            </span>
            <input
              className={fieldClass}
              defaultValue={rawFilters.flowId ?? ""}
              name="flowId"
              placeholder="flow id"
            />
          </label>

          <button className={actionButtonClass("primary")} type="submit">
            Apply
          </button>
        </form>
      </Panel>

      <Panel>
        <PanelTitle title="Alerts" />
        {result.alerts.length === 0 ? (
          <div className="mt-5">
            <EmptyState>No alerts match these filters.</EmptyState>
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#D7F1E2] text-xs uppercase text-[#526173]">
                <tr>
                  <th className="py-3 pr-4">Severity</th>
                  <th className="py-3 pr-4">Title</th>
                  <th className="py-3 pr-4">Flow</th>
                  <th className="py-3 pr-4">Node</th>
                  <th className="py-3 pr-4">Count</th>
                  <th className="py-3 pr-4">Last seen</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7F8EF]">
                {result.alerts.map((alert) => (
                  <tr key={alert.id}>
                    <td className="py-3 pr-4">
                      <StatusPill tone={statusTone(alert.severity)}>
                        {alert.severity}
                      </StatusPill>
                    </td>
                    <td className="max-w-xs py-3 pr-4">
                      <p className="font-semibold text-[#081B3A]">{alert.title}</p>
                      <p className="mt-1 truncate text-xs text-[#526173]">
                        {alert.message}
                      </p>
                    </td>
                    <td className="py-3 pr-4">{alert.flowName ?? "-"}</td>
                    <td className="py-3 pr-4">
                      {alert.nodeLabel ?? alert.nodeType ?? "-"}
                    </td>
                    <td className="py-3 pr-4">{alert.count}</td>
                    <td className="py-3 pr-4">
                      {new Date(alert.lastSeenAt).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusPill tone={statusTone(alert.status)}>
                        {alert.status}
                      </StatusPill>
                    </td>
                    <td className="py-3">
                      <Link
                        className="font-semibold text-[#128C7E]"
                        href={`/dashboard/automation/alerts/${alert.id}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between text-sm text-[#526173]">
          <span>
            Page {result.pagination.page} of {result.pagination.totalPages}
          </span>
          <div className="flex gap-2">
            {result.pagination.page > 1 ? (
              <Link
                className={actionButtonClass("secondary")}
                href={buildPageHref(rawFilters, result.pagination.page - 1)}
              >
                Previous
              </Link>
            ) : null}
            {result.pagination.page < result.pagination.totalPages ? (
              <Link
                className={actionButtonClass("secondary")}
                href={buildPageHref(rawFilters, result.pagination.page + 1)}
              >
                Next
              </Link>
            ) : null}
          </div>
        </div>
      </Panel>
    </div>
  );
}
