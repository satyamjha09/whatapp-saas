import {
  AlertTriangle,
  BarChart3,
  BookOpenCheck,
  ClipboardList,
  GitPullRequestArrow,
  MonitorCheck,
  Plus,
  Rocket,
  Workflow,
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
  statusTone,
} from "@/app/dashboard/dashboard-ui";
import { prisma } from "@/lib/prisma";
import { normalizeAutomationGraph } from "@/lib/automation-builder/node-defaults";
import type { AutomationGraph } from "@/lib/automation-builder/types";
import { AUTOMATION_FLOW_TEMPLATES } from "@/lib/automation-templates/template-registry";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { checkUserAutomationPermission } from "@/server/services/automation-permission.service";

function formatDate(value: Date | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function graphStats(value: unknown) {
  try {
    const graph = normalizeAutomationGraph(value as AutomationGraph);

    return {
      edges: graph.edges.length,
      nodes: graph.nodes.length,
    };
  } catch {
    return {
      edges: 0,
      nodes: 0,
    };
  }
}

function triggerLabel(flow: {
  isDefault: boolean;
  keywords: string[];
  triggerType: string | null;
}) {
  if (flow.isDefault) return "Default";
  if (flow.triggerType === "KEYWORD" && flow.keywords.length > 0) {
    return flow.keywords.slice(0, 3).join(", ");
  }

  return flow.triggerType ? flow.triggerType.replaceAll("_", " ") : "Not set";
}

function executionCount(
  groups: Array<{ status: string; _count: { _all: number } }>,
  status: string,
) {
  return (
    groups.find((group) => group.status === status)?._count._all ?? 0
  ).toLocaleString("en-IN");
}

export default async function DashboardAutomationPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const companyId = context.membership.companyId;
  const [
    canViewFlows,
    canCreateFlow,
    canViewAnalytics,
    canViewExecutions,
    canUseTemplates,
    canRequestPublish,
    canApprovePublish,
    canViewMonitoring,
    canViewAlerts,
  ] = await Promise.all([
    checkUserAutomationPermission(companyId, context.user.id, "automation.flow.view"),
    checkUserAutomationPermission(companyId, context.user.id, "automation.flow.create"),
    checkUserAutomationPermission(companyId, context.user.id, "automation.analytics.view"),
    checkUserAutomationPermission(companyId, context.user.id, "automation.execution.view"),
    checkUserAutomationPermission(companyId, context.user.id, "automation.template_library.use"),
    checkUserAutomationPermission(companyId, context.user.id, "automation.flow.request_publish"),
    checkUserAutomationPermission(companyId, context.user.id, "automation.flow.approve_publish"),
    checkUserAutomationPermission(companyId, context.user.id, "automation.monitoring.view"),
    checkUserAutomationPermission(companyId, context.user.id, "automation.alert.view"),
  ]);

  if (!canViewFlows) redirect("/dashboard");

  const since7Days = new Date();
  since7Days.setDate(since7Days.getDate() - 7);
  const [flows, executionGroups, activeSessions, openAlerts, pendingApprovals] =
    await Promise.all([
      prisma.automationFlow.findMany({
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          _count: {
            select: {
              executions: true,
              publishRequests: true,
              sessions: true,
              versions: true,
            },
          },
          createdAt: true,
          description: true,
          draftGraph: true,
          id: true,
          isDefault: true,
          keywords: true,
          name: true,
          publishedAt: true,
          publishedVersionId: true,
          status: true,
          triggerType: true,
          updatedAt: true,
        },
        where: {
          companyId,
          status: {
            not: "ARCHIVED",
          },
        },
      }),
      prisma.automationExecution.groupBy({
        _count: {
          _all: true,
        },
        by: ["status"],
        where: {
          companyId,
          startedAt: {
            gte: since7Days,
          },
        },
      }),
      prisma.automationSession.count({
        where: {
          companyId,
          status: "ACTIVE",
        },
      }),
      prisma.automationAlert.count({
        where: {
          companyId,
          status: "OPEN",
        },
      }),
      prisma.automationPublishRequest.count({
        where: {
          companyId,
          status: "PENDING",
        },
      }),
    ]);

  const flowSummary = flows.reduce(
    (summary, flow) => {
      summary.total += 1;
      if (flow.status === "DRAFT") summary.draft += 1;
      if (flow.status === "PUBLISHED") summary.published += 1;
      if (flow.status === "PAUSED") summary.paused += 1;
      return summary;
    },
    { draft: 0, paused: 0, published: 0, total: 0 },
  );
  const canSeeApprovals = canRequestPublish || canApprovePublish;

  const quickLinks = [
    canUseTemplates
      ? {
          description: `${AUTOMATION_FLOW_TEMPLATES.length} ready-made flow templates`,
          href: "/dashboard/automation/templates",
          icon: BookOpenCheck,
          label: "Templates Library",
        }
      : null,
    canViewExecutions
      ? {
          description: "Review runtime logs, failed nodes, and waiting sessions",
          href: "/dashboard/automation/executions",
          icon: ClipboardList,
          label: "Execution Logs",
        }
      : null,
    canSeeApprovals
      ? {
          description: `${pendingApprovals.toLocaleString("en-IN")} pending publish request(s)`,
          href: "/dashboard/automation/approvals",
          icon: GitPullRequestArrow,
          label: "Publish Approvals",
        }
      : null,
    canViewMonitoring
      ? {
          description: "Worker health, queue state, failures, and integrations",
          href: "/dashboard/automation/monitoring",
          icon: MonitorCheck,
          label: "Monitoring",
        }
      : null,
    canViewAlerts
      ? {
          description: `${openAlerts.toLocaleString("en-IN")} open alert(s)`,
          href: "/dashboard/automation/alerts",
          icon: AlertTriangle,
          label: "Alerts",
        }
      : null,
  ].filter(
    (
      link,
    ): link is {
      description: string;
      href: string;
      icon: typeof Workflow;
      label: string;
    } => Boolean(link),
  );

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Automation"
        description="Manage WhatsApp automation flows, templates, runtime logs, approvals, and production health from one place."
        actions={
          canCreateFlow ? (
            <Link className={actionButtonClass()} href="/automation/builder/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Automation
            </Link>
          ) : null
        }
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          icon={Workflow}
          label="Flows"
          value={flowSummary.total.toLocaleString("en-IN")}
          detail={`${flowSummary.published} published, ${flowSummary.draft} draft, ${flowSummary.paused} paused`}
        />
        <MetricCard
          icon={Rocket}
          label="Published"
          value={flowSummary.published.toLocaleString("en-IN")}
        />
        <MetricCard
          icon={ClipboardList}
          label="Executions, 7 days"
          value={executionGroups
            .reduce((total, group) => total + group._count._all, 0)
            .toLocaleString("en-IN")}
          detail={`${executionCount(executionGroups, "FAILED")} failed`}
        />
        <MetricCard
          icon={MonitorCheck}
          label="Active sessions"
          value={activeSessions.toLocaleString("en-IN")}
        />
        <MetricCard
          icon={AlertTriangle}
          label="Open alerts"
          value={openAlerts.toLocaleString("en-IN")}
        />
      </section>

      {quickLinks.length > 0 ? (
        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {quickLinks.map((link) => {
            const Icon = link.icon;

            return (
              <Link
                className="group rounded-2xl border border-[#BFE9D0] bg-white p-4 shadow-[0_14px_34px_rgba(8,27,58,0.07)] transition hover:-translate-y-0.5 hover:border-[#128C7E]/35 hover:bg-[#F7FBFF]"
                href={link.href}
                key={link.href}
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E7F8EF] text-[#128C7E] transition group-hover:bg-[#128C7E] group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-4 text-sm font-bold text-[#081B3A]">
                  {link.label}
                </p>
                <p className="mt-1 text-xs leading-5 text-[#526173]">
                  {link.description}
                </p>
              </Link>
            );
          })}
        </section>
      ) : null}

      <Panel className="overflow-hidden p-0 sm:p-0">
        <div className="flex flex-col gap-3 border-b border-[#BFE9D0] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <PanelTitle
            title="Automation flows"
            description="Open a flow in the full-screen builder or inspect its analytics and executions."
          />
          <Link
            className={actionButtonClass("secondary")}
            href="/automation/builder"
          >
            Open latest builder
          </Link>
        </div>

        {flows.length === 0 ? (
          <div className="p-5 sm:p-6">
            <EmptyState>
              No automation flows yet. Create your first WhatsApp automation to
              start building message, condition, handoff, API, and template
              journeys.
            </EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-[#E7F8EF] text-xs uppercase text-[#526173]">
                <tr>
                  <th className="px-5 py-3">Flow</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Trigger</th>
                  <th className="px-5 py-3">Graph</th>
                  <th className="px-5 py-3">Runtime</th>
                  <th className="px-5 py-3">Published</th>
                  <th className="px-5 py-3">Updated</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#BFE9D0]">
                {flows.map((flow) => {
                  const stats = graphStats(flow.draftGraph);

                  return (
                    <tr key={flow.id} className="align-top">
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#E7F8EF] text-[#128C7E]">
                            <Workflow className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <Link
                              className="font-semibold text-[#081B3A] hover:text-[#128C7E]"
                              href={`/automation/builder/${flow.id}`}
                            >
                              {flow.name}
                            </Link>
                            <p className="mt-1 line-clamp-2 max-w-md text-xs leading-5 text-[#526173]">
                              {flow.description ?? "No description added yet."}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill tone={statusTone(flow.status)}>
                          {flow.status}
                        </StatusPill>
                      </td>
                      <td className="px-5 py-4 text-[#526173]">
                        {triggerLabel(flow)}
                      </td>
                      <td className="px-5 py-4 text-[#526173]">
                        {stats.nodes} nodes, {stats.edges} edges
                        <p className="mt-1 text-xs">
                          {flow._count.versions} version(s)
                        </p>
                      </td>
                      <td className="px-5 py-4 text-[#526173]">
                        {flow._count.executions.toLocaleString("en-IN")} runs
                        <p className="mt-1 text-xs">
                          {flow._count.sessions.toLocaleString("en-IN")} sessions
                        </p>
                      </td>
                      <td className="px-5 py-4 text-[#526173]">
                        {formatDate(flow.publishedAt)}
                      </td>
                      <td className="px-5 py-4 text-[#526173]">
                        {formatDate(flow.updatedAt)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            className="rounded-lg bg-[#128C7E] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#075E54]"
                            href={`/automation/builder/${flow.id}`}
                          >
                            Builder
                          </Link>
                          {canViewAnalytics ? (
                            <Link
                              className="inline-flex items-center rounded-lg border border-[#BFE9D0] bg-white px-3 py-2 text-xs font-semibold text-[#128C7E] transition hover:bg-[#E7F8EF]"
                              href={`/dashboard/automation/flows/${flow.id}/analytics`}
                            >
                              <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
                              Analytics
                            </Link>
                          ) : null}
                          {canViewExecutions ? (
                            <Link
                              className="inline-flex items-center rounded-lg border border-[#BFE9D0] bg-white px-3 py-2 text-xs font-semibold text-[#128C7E] transition hover:bg-[#E7F8EF]"
                              href={`/dashboard/automation/executions?flowId=${flow.id}`}
                            >
                              <ClipboardList className="mr-1.5 h-3.5 w-3.5" />
                              Logs
                            </Link>
                          ) : null}
                        </div>
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
