import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  GitBranch,
  MessageSquareText,
  ShieldCheck,
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
import { getAutomationExecutionDetail } from "@/server/services/automation-execution-log.service";

type ExecutionDetailPageProps = {
  params: Promise<{
    executionId: string;
  }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatDuration(durationMs?: number) {
  if (durationMs === undefined) return "-";
  if (durationMs < 1000) return `${durationMs}ms`;

  return `${(durationMs / 1000).toFixed(1)}s`;
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[360px] overflow-auto rounded-xl border border-[#BFE9D0] bg-[#07151F] p-4 text-xs leading-5 text-[#D7FBE8]">
      {JSON.stringify(value ?? null, null, 2)}
    </pre>
  );
}

function graphNodes(graph: unknown) {
  if (!isRecord(graph) || !Array.isArray(graph.nodes)) return [];

  return graph.nodes
    .map((node) => (isRecord(node) ? node : null))
    .filter((node): node is Record<string, unknown> => Boolean(node));
}

function graphEdges(graph: unknown) {
  if (!isRecord(graph) || !Array.isArray(graph.edges)) return [];

  return graph.edges
    .map((edge) => (isRecord(edge) ? edge : null))
    .filter((edge): edge is Record<string, unknown> => Boolean(edge));
}

function nodeLabel(node: Record<string, unknown>) {
  const data = isRecord(node.data) ? node.data : {};
  return typeof data.label === "string" && data.label.trim()
    ? data.label
    : String(node.type ?? node.id ?? "Node");
}

export default async function AutomationExecutionDetailPage({
  params,
}: ExecutionDetailPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const canViewExecutions = await checkUserAutomationPermission(
    context.membership.companyId,
    context.user.id,
    "automation.execution.view",
  );
  if (!canViewExecutions) redirect("/dashboard");

  const { executionId } = await params;
  const detail = await getAutomationExecutionDetail(
    context.membership.companyId,
    executionId,
  );

  if (!detail) notFound();

  const executedNodeIds = new Set(detail.steps.map((step) => step.nodeId));
  const failedNodeIds = new Set(
    detail.steps
      .filter((step) => step.status === "FAILED")
      .map((step) => step.nodeId),
  );
  const waitingNodeId = detail.execution.session?.waitingForReply
    ? detail.execution.session.currentNodeId
    : null;
  const nodes = graphNodes(detail.graph);
  const edges = graphEdges(detail.graph);

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Automation Execution Detail"
        description="Debug a single automation run with sanitized inputs, outputs, timeline, and graph context."
        actions={
          <>
            <Link
              href="/dashboard/automation/executions"
              className={actionButtonClass("secondary")}
            >
              All executions
            </Link>
            <Link
              href={`/automation/builder/${detail.execution.flowId}`}
              className={actionButtonClass("secondary")}
            >
              Open builder
            </Link>
            {detail.execution.contact ? (
              <Link
                href={`/dashboard/inbox/${detail.execution.contact.id}`}
                className={actionButtonClass()}
              >
                Open contact
              </Link>
            ) : null}
          </>
        }
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={ShieldCheck}
          label="Status"
          value={detail.execution.status}
          detail={detail.execution.errorMessage ?? "No execution error recorded"}
        />
        <MetricCard
          icon={GitBranch}
          label="Flow version"
          value={`v${detail.execution.versionNumber ?? "-"}`}
          detail={detail.execution.flowName}
        />
        <MetricCard
          icon={Clock3}
          label="Duration"
          value={formatDuration(detail.execution.durationMs)}
          detail={new Date(detail.execution.startedAt).toLocaleString()}
        />
        <MetricCard
          icon={MessageSquareText}
          label="Contact"
          value={detail.execution.contact?.name ?? "Unknown"}
          detail={detail.execution.contact?.phoneNumber ?? "No phone"}
        />
      </section>

      <section className="mb-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel>
          <PanelTitle
            title="Execution timeline"
            description="Step-by-step runtime events for this execution."
          />
          <div className="mt-5 space-y-3">
            {detail.timeline.map((event, index) => (
              <div
                key={`${event.timestamp}-${event.type}-${index}`}
                className="rounded-xl border border-[#BFE9D0] bg-[#F7FFFA] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#081B3A]">{event.title}</p>
                    {event.description ? (
                      <p className="mt-1 text-sm text-[#526173]">
                        {event.description}
                      </p>
                    ) : null}
                  </div>
                  <StatusPill
                    tone={
                      event.type.includes("FAILED")
                        ? "red"
                        : event.type.includes("WAITING")
                          ? "amber"
                          : "green"
                    }
                  >
                    {event.type}
                  </StatusPill>
                </div>
                <p className="mt-2 text-xs text-[#526173]">
                  {new Date(event.timestamp).toLocaleString()}
                  {event.nodeId ? ` · ${event.nodeId}` : ""}
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelTitle
            title="Flow graph preview"
            description="Executed nodes are highlighted. Failed and waiting nodes get stronger status colors."
          />
          {nodes.length === 0 ? (
            <div className="mt-5">
              <EmptyState>Graph snapshot is unavailable for this execution.</EmptyState>
            </div>
          ) : (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {nodes.map((node) => {
                const nodeId = String(node.id ?? "");
                const failed = failedNodeIds.has(nodeId);
                const waiting = waitingNodeId === nodeId;
                const executed = executedNodeIds.has(nodeId);

                return (
                  <div
                    key={nodeId}
                    className={[
                      "rounded-xl border p-4",
                      failed
                        ? "border-rose-200 bg-rose-50"
                        : waiting
                          ? "border-amber-200 bg-amber-50"
                          : executed
                            ? "border-[#128C7E]/35 bg-[#E7F8EF]"
                            : "border-[#BFE9D0] bg-white",
                    ].join(" ")}
                  >
                    <p className="font-semibold text-[#081B3A]">
                      {nodeLabel(node)}
                    </p>
                    <p className="mt-1 text-xs text-[#526173]">
                      {String(node.type ?? "-")} · {nodeId}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {edges.length > 0 ? (
            <div className="mt-6">
              <p className="text-sm font-semibold text-[#081B3A]">Edges</p>
              <div className="mt-3 max-h-56 space-y-2 overflow-auto">
                {edges.map((edge, index) => (
                  <div
                    key={String(edge.id ?? index)}
                    className="flex items-center gap-2 rounded-lg border border-[#BFE9D0] bg-white px-3 py-2 text-xs text-[#526173]"
                  >
                    <span className="font-mono">{String(edge.source ?? "-")}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                    <span className="font-mono">{String(edge.target ?? "-")}</span>
                    {edge.sourceHandle ? (
                      <span className="ml-auto rounded-full bg-[#E7F8EF] px-2 py-1 text-[#128C7E]">
                        {String(edge.sourceHandle)}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Panel>
      </section>

      <Panel className="mb-6 overflow-hidden p-0 sm:p-0">
        <div className="border-b border-[#BFE9D0] px-5 py-4 sm:px-6">
          <PanelTitle
            title="Step details"
            description="Inputs and outputs are sanitized before display."
          />
        </div>

        {detail.steps.length === 0 ? (
          <div className="p-5 sm:p-6">
            <EmptyState>No steps were recorded for this execution.</EmptyState>
          </div>
        ) : (
          <div className="divide-y divide-[#BFE9D0]">
            {detail.steps.map((step) => (
              <details key={step.id} className="group p-5 sm:p-6">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#081B3A]">
                      {step.nodeLabel ?? step.nodeType}
                    </p>
                    <p className="mt-1 text-xs text-[#526173]">
                      {step.nodeType} · {step.nodeId}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {step.sourceHandle ? (
                      <span className="rounded-full bg-[#E7F8EF] px-3 py-1 text-xs font-medium text-[#128C7E]">
                        {step.sourceHandle}
                        {step.targetNodeId ? ` → ${step.targetNodeId}` : ""}
                      </span>
                    ) : null}
                    <span className="text-sm text-[#526173]">
                      {formatDuration(step.durationMs)}
                    </span>
                    <StatusPill tone={statusTone(step.status)}>
                      {step.status}
                    </StatusPill>
                  </div>
                </summary>

                {step.errorMessage ? (
                  <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    <AlertTriangle className="mr-2 inline h-4 w-4" />
                    {step.errorMessage}
                  </div>
                ) : null}

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm font-semibold text-[#081B3A]">
                      Input
                    </p>
                    <JsonBlock value={step.input} />
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-semibold text-[#081B3A]">
                      Output
                    </p>
                    <JsonBlock value={step.output} />
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </Panel>

      <Panel>
        <PanelTitle
          title="Raw sanitized execution JSON"
          description="Useful for support/debugging. Secrets and large payloads are redacted."
        />
        <div className="mt-5">
          <JsonBlock value={detail.execution} />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className={actionButtonClass("secondary")} disabled type="button">
            Retry coming later
          </button>
          <Link
            href={`/dashboard/automation/flows/${detail.execution.flowId}/analytics`}
            className={actionButtonClass("secondary")}
          >
            Flow analytics
          </Link>
          <Link
            href={`/dashboard/automation/executions?flowId=${detail.execution.flowId}`}
            className={actionButtonClass("secondary")}
          >
            Flow executions
          </Link>
        </div>
      </Panel>
    </div>
  );
}
