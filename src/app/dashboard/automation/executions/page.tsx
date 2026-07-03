import {
  AlertTriangle,
  Clock3,
  FileText,
  ListFilter,
  PlayCircle,
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
  labelClass,
  statusTone,
} from "@/app/dashboard/dashboard-ui";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { checkUserAutomationPermission } from "@/server/services/automation-permission.service";
import { getAutomationExecutionList } from "@/server/services/automation-execution-log.service";
import { automationExecutionListQuerySchema } from "@/server/validators/automation-analytics.validator";

type AutomationExecutionsPageProps = {
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

function buildPageHref(
  filters: Record<string, string | undefined>,
  page: number,
) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value && key !== "page") params.set(key, value);
  });

  params.set("page", String(page));
  return `/dashboard/automation/executions?${params.toString()}`;
}

function formatDuration(durationMs?: number) {
  if (durationMs === undefined) return "-";
  if (durationMs < 1000) return `${durationMs}ms`;

  return `${(durationMs / 1000).toFixed(1)}s`;
}

export default async function AutomationExecutionsPage({
  searchParams,
}: AutomationExecutionsPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const canViewExecutions = await checkUserAutomationPermission(
    context.membership.companyId,
    context.user.id,
    "automation.execution.view",
  );
  if (!canViewExecutions) redirect("/dashboard");

  const rawFilters = normalizeSearchParams(await searchParams);
  const parsedFilters = automationExecutionListQuerySchema.safeParse(rawFilters);
  const filters = parsedFilters.success
    ? parsedFilters.data
    : automationExecutionListQuerySchema.parse({});
  const [result, flows] = await Promise.all([
    getAutomationExecutionList(context.membership.companyId, filters),
    prisma.automationFlow.findMany({
      where: {
        companyId: context.membership.companyId,
        status: {
          not: "ARCHIVED",
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);
  const counts = result.executions.reduce(
    (summary, execution) => {
      summary.total += 1;
      if (execution.status === "FAILED") summary.failed += 1;
      if (execution.status === "SUCCESS") summary.success += 1;
      if (execution.status === "WAITING") summary.waiting += 1;
      return summary;
    },
    { failed: 0, success: 0, total: 0, waiting: 0 },
  );

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Automation Execution Logs"
        description="Inspect every automation run, failed node, trigger, contact, duration, and sanitized execution data."
        actions={
          <>
            <Link
              href="/dashboard/automation/builder"
              className={actionButtonClass("secondary")}
            >
              Open Builder
            </Link>
          </>
        }
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={PlayCircle}
          label="Executions on this page"
          value={counts.total.toLocaleString("en-IN")}
          detail={`${result.pagination.total.toLocaleString("en-IN")} total matching filters`}
        />
        <MetricCard
          icon={FileText}
          label="Successful"
          value={counts.success.toLocaleString("en-IN")}
        />
        <MetricCard
          icon={AlertTriangle}
          label="Failed"
          value={counts.failed.toLocaleString("en-IN")}
        />
        <MetricCard
          icon={Clock3}
          label="Waiting"
          value={counts.waiting.toLocaleString("en-IN")}
        />
      </section>

      <Panel className="mb-6">
        <PanelTitle
          title="Filters"
          description="Filter logs without loading heavy input/output payloads."
        />
        <form className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <label>
            <span className={labelClass}>Flow</span>
            <select className={fieldClass} name="flowId" defaultValue={rawFilters.flowId ?? ""}>
              <option value="">All flows</option>
              {flows.map((flow) => (
                <option key={flow.id} value={flow.id}>
                  {flow.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className={labelClass}>Status</span>
            <select className={fieldClass} name="status" defaultValue={rawFilters.status ?? ""}>
              <option value="">All statuses</option>
              {["RUNNING", "SUCCESS", "FAILED", "WAITING", "SKIPPED"].map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className={labelClass}>Trigger</span>
            <select
              className={fieldClass}
              name="triggerType"
              defaultValue={rawFilters.triggerType ?? ""}
            >
              <option value="">All triggers</option>
              {[
                "KEYWORD",
                "DEFAULT",
                "TEMPLATE_REPLY",
                "BUTTON_REPLY",
                "LIST_REPLY",
                "CAMPAIGN_REPLY",
                "MANUAL",
              ].map((trigger) => (
                <option key={trigger} value={trigger}>
                  {trigger}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className={labelClass}>Contact</span>
            <input
              className={fieldClass}
              name="contactSearch"
              placeholder="Name, phone, email"
              defaultValue={rawFilters.contactSearch ?? ""}
            />
          </label>

          <label>
            <span className={labelClass}>From</span>
            <input
              className={fieldClass}
              name="startDate"
              type="date"
              defaultValue={rawFilters.startDate ?? ""}
            />
          </label>

          <label>
            <span className={labelClass}>To</span>
            <input
              className={fieldClass}
              name="endDate"
              type="date"
              defaultValue={rawFilters.endDate ?? ""}
            />
          </label>

          <div className="flex items-end gap-3 xl:col-span-6">
            <button className={actionButtonClass()} type="submit">
              <ListFilter className="mr-2 h-4 w-4" />
              Apply filters
            </button>
            <Link
              href="/dashboard/automation/executions"
              className={actionButtonClass("secondary")}
            >
              Reset
            </Link>
          </div>
        </form>
      </Panel>

      <Panel className="overflow-hidden p-0 sm:p-0">
        <div className="border-b border-[#BFE9D0] px-5 py-4 sm:px-6">
          <PanelTitle
            title="Execution log"
            description={`Page ${result.pagination.page} of ${result.pagination.totalPages}`}
          />
        </div>

        {result.executions.length === 0 ? (
          <div className="p-5 sm:p-6">
            <EmptyState>
              No automation executions yet. Publish a flow and trigger it from
              WhatsApp to see execution logs.
            </EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="bg-[#E7F8EF] text-xs uppercase text-[#526173]">
                <tr>
                  <th className="px-5 py-3">Time</th>
                  <th className="px-5 py-3">Flow</th>
                  <th className="px-5 py-3">Version</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Trigger</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Duration</th>
                  <th className="px-5 py-3">Failed node</th>
                  <th className="px-5 py-3">Steps</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#BFE9D0]">
                {result.executions.map((execution) => (
                  <tr key={execution.id}>
                    <td className="whitespace-nowrap px-5 py-4 text-[#526173]">
                      {new Date(execution.startedAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-[#081B3A]">
                        {execution.flowName}
                      </p>
                      <p className="mt-1 font-mono text-xs text-[#526173]">
                        {execution.id}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-[#526173]">
                      v{execution.versionNumber ?? "-"}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-[#081B3A]">
                        {execution.contact?.name ?? "Unknown contact"}
                      </p>
                      <p className="mt-1 text-xs text-[#526173]">
                        {execution.contact?.phoneNumber ?? "-"}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-[#526173]">
                      {execution.triggerType ?? "-"}
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill tone={statusTone(execution.status)}>
                        {execution.status}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-4 text-[#526173]">
                      {formatDuration(execution.durationMs)}
                    </td>
                    <td className="px-5 py-4 text-[#526173]">
                      {execution.failedNodeType
                        ? `${execution.failedNodeType} (${execution.failedNodeId})`
                        : "-"}
                    </td>
                    <td className="px-5 py-4 text-[#526173]">
                      {execution.stepCount}
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        className={actionButtonClass("secondary")}
                        href={`/dashboard/automation/executions/${execution.id}`}
                      >
                        View details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-[#BFE9D0] bg-[#E7F8EF] px-5 py-4 text-sm sm:px-6">
          <p className="text-[#526173]">
            {result.pagination.total.toLocaleString("en-IN")} matching executions
          </p>
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
