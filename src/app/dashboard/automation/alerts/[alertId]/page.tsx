import {
  AlertTriangle,
  ArrowLeft,
  ClipboardList,
  GitBranch,
  ListChecks,
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
import { checkUserAutomationPermission } from "@/server/services/automation-permission.service";
import { getAlertDetail } from "@/server/services/automation-alert.service";
import { AlertActionButton } from "../alert-actions";

type AlertDetailPageProps = {
  params: Promise<{ alertId: string }>;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN");
}

export default async function AutomationAlertDetailPage({
  params,
}: AlertDetailPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const [canView, canManage] = await Promise.all([
    checkUserAutomationPermission(
      context.membership.companyId,
      context.user.id,
      "automation.alert.view",
    ),
    checkUserAutomationPermission(
      context.membership.companyId,
      context.user.id,
      "automation.alert.manage",
    ),
  ]);

  if (!canView) redirect("/dashboard");

  const { alertId } = await params;
  const result = await getAlertDetail(context.membership.companyId, alertId);
  if (!result) notFound();

  const { alert } = result;

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title={alert.title}
        description={alert.message}
        actions={
          <>
            <Link
              className={actionButtonClass("secondary")}
              href="/dashboard/automation/alerts"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to alerts
            </Link>
            {canManage ? (
              <>
                <AlertActionButton action="acknowledge" alertId={alert.id} />
                <AlertActionButton action="resolve" alertId={alert.id} />
                <AlertActionButton action="mute" alertId={alert.id} />
              </>
            ) : null}
          </>
        }
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={AlertTriangle} label="Severity" value={alert.severity} />
        <MetricCard icon={ListChecks} label="Status" value={alert.status} />
        <MetricCard icon={ClipboardList} label="Count" value={alert.count} />
        <MetricCard
          icon={GitBranch}
          label="Last seen"
          value={formatDate(alert.lastSeenAt)}
        />
      </section>

      <section className="mb-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel>
          <PanelTitle
            title="What Happened"
            description="This alert is generated from sanitized execution, queue, worker, and integration signals."
          />
          <div className="mt-5 space-y-4 text-sm text-[#526173]">
            <div className="flex flex-wrap gap-3">
              <StatusPill tone={statusTone(alert.severity)}>
                {alert.severity}
              </StatusPill>
              <StatusPill tone={statusTone(alert.status)}>
                {alert.status}
              </StatusPill>
              <StatusPill tone="zinc">{alert.type}</StatusPill>
            </div>
            <p>
              First seen {formatDate(alert.firstSeenAt)} and last seen{" "}
              {formatDate(alert.lastSeenAt)}.
            </p>
            {alert.flow ? (
              <p>
                Flow:{" "}
                <Link
                  className="font-semibold text-[#128C7E]"
                  href={`/automation/builder/${alert.flow.id}`}
                >
                  {alert.flow.name}
                </Link>
              </p>
            ) : null}
            {alert.node ? (
              <p>
                Node: {alert.node.label ?? alert.node.type ?? alert.node.id}
              </p>
            ) : null}
            {alert.queueName ? <p>Queue: {alert.queueName}</p> : null}
            {alert.integrationType ? (
              <p>Integration: {alert.integrationType}</p>
            ) : null}
          </div>
        </Panel>

        <Panel>
          <PanelTitle title="Recommended Actions" />
          <div className="mt-5 space-y-3">
            {result.recommendedActions.map((action) => (
              <div
                className="rounded-xl border border-[#D7F1E2] p-4"
                key={action.title}
              >
                <p className="font-semibold text-[#081B3A]">{action.title}</p>
                <p className="mt-1 text-sm leading-6 text-[#526173]">
                  {action.description}
                </p>
                {action.actionUrl ? (
                  <Link
                    className="mt-2 inline-flex text-sm font-semibold text-[#128C7E]"
                    href={action.actionUrl}
                  >
                    Open
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <Panel className="mb-6">
        <PanelTitle title="Related Executions" />
        {result.relatedExecutions.length === 0 ? (
          <div className="mt-5">
            <EmptyState>No related failed executions found.</EmptyState>
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#D7F1E2] text-xs uppercase text-[#526173]">
                <tr>
                  <th className="py-3 pr-4">Execution</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Failed node</th>
                  <th className="py-3 pr-4">Started</th>
                  <th className="py-3">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7F8EF]">
                {result.relatedExecutions.map((execution) => (
                  <tr key={execution.id}>
                    <td className="py-3 pr-4">
                      <Link
                        className="font-semibold text-[#128C7E]"
                        href={`/dashboard/automation/executions/${execution.id}`}
                      >
                        {execution.id}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      <StatusPill tone={statusTone(execution.status)}>
                        {execution.status}
                      </StatusPill>
                    </td>
                    <td className="py-3 pr-4">
                      {execution.failedNodeType ?? execution.failedNodeId ?? "-"}
                    </td>
                    <td className="py-3 pr-4">{formatDate(execution.startedAt)}</td>
                    <td className="max-w-md truncate py-3">
                      {execution.errorMessage ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel>
          <PanelTitle title="Related Failed Steps" />
          {result.relatedSteps.length === 0 ? (
            <div className="mt-5">
              <EmptyState>No related failed node steps found.</EmptyState>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {result.relatedSteps.map((step) => (
                <div
                  className="rounded-xl border border-[#D7F1E2] p-4"
                  key={`${step.executionId}:${step.nodeId}:${step.startedAt}`}
                >
                  <p className="font-semibold text-[#081B3A]">
                    {step.nodeType} · {step.nodeId}
                  </p>
                  <p className="mt-1 text-sm text-[#526173]">
                    {formatDate(step.startedAt)}
                  </p>
                  <p className="mt-2 text-sm text-[#526173]">
                    {step.errorMessage ?? "No error message captured."}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <PanelTitle
            title="Sanitized Metadata"
            description="Secrets and oversized values are redacted before storage."
          />
          <pre className="mt-5 max-h-[520px] overflow-auto rounded-xl bg-[#081B3A] p-4 text-xs leading-5 text-white">
            {JSON.stringify(alert.metadata ?? {}, null, 2)}
          </pre>
        </Panel>
      </section>
    </div>
  );
}
