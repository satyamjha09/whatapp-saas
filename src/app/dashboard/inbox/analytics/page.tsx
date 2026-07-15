import Link from "next/link";
import {
  BarChart3,
  Clock3,
  MessageCircleReply,
  RotateCcw,
  ShieldCheck,
  TimerReset,
  UserCheck,
} from "lucide-react";
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
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  getInboxAgentAnalytics,
  getInboxAnalyticsSummary,
  getInboxQueueAnalytics,
  getInboxSlaAnalytics,
} from "@/server/services/inbox-analytics.service";

function parseDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return "No data";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round((seconds / 3600) * 10) / 10}h`;
}

function formatDateInput(date?: string) {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

export default async function InboxAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    agentId?: string;
    from?: string;
    queueId?: string;
    to?: string;
  }>;
}) {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const resolvedSearchParams = await searchParams;
  const filters = {
    agentId: resolvedSearchParams?.agentId ?? null,
    queueId: resolvedSearchParams?.queueId ?? null,
    dateFrom: parseDate(resolvedSearchParams?.from),
    dateTo: parseDate(resolvedSearchParams?.to),
  };
  const [summary, agents, queues, sla] = await Promise.all([
    getInboxAnalyticsSummary(context.membership.companyId, filters),
    getInboxAgentAnalytics(context.membership.companyId, filters),
    getInboxQueueAnalytics(context.membership.companyId, filters),
    getInboxSlaAnalytics(context.membership.companyId, filters),
  ]);
  const maxDaily = Math.max(
    1,
    ...summary.daily.map((day) => day.assigned + day.replies + day.resolved),
  );
  const maxQueue = Math.max(1, ...queues.map((queue) => queue.assigned));

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Inbox Analytics"
        description="Durable supervisor analytics for agent performance, queue volume, SLA compliance, response speed, and resolution work."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/inbox/monitoring" className={actionButtonClass("secondary")}>
              Live monitoring
            </Link>
            <Link href="/dashboard/inbox" className={actionButtonClass("primary")}>
              Open inbox
            </Link>
          </div>
        }
      />

      <Panel>
        <form className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          <label>
            <span className={labelClass}>From</span>
            <input
              className={fieldClass}
              defaultValue={formatDateInput(resolvedSearchParams?.from)}
              name="from"
              type="date"
            />
          </label>
          <label>
            <span className={labelClass}>To</span>
            <input
              className={fieldClass}
              defaultValue={formatDateInput(resolvedSearchParams?.to)}
              name="to"
              type="date"
            />
          </label>
          <label>
            <span className={labelClass}>Queue</span>
            <select
              className={fieldClass}
              defaultValue={resolvedSearchParams?.queueId ?? ""}
              name="queueId"
            >
              <option value="">All queues</option>
              {summary.filtersData.queues.map((queue) => (
                <option key={queue.id} value={queue.id}>
                  {queue.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClass}>Agent</span>
            <select
              className={fieldClass}
              defaultValue={resolvedSearchParams?.agentId ?? ""}
              name="agentId"
            >
              <option value="">All agents</option>
              {summary.filtersData.agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name ?? agent.email}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button className={actionButtonClass("primary")} type="submit">
              Apply
            </button>
          </div>
        </form>
      </Panel>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail="Conversations assigned to agents."
          icon={UserCheck}
          label="Assigned"
          value={summary.totals.assigned}
        />
        <MetricCard
          detail="Outbound agent replies."
          icon={MessageCircleReply}
          label="Replies"
          value={summary.totals.replies}
        />
        <MetricCard
          detail="Conversations resolved."
          icon={ShieldCheck}
          label="Resolved"
          value={summary.totals.resolved}
        />
        <MetricCard
          detail="Reopened after resolution."
          icon={RotateCcw}
          label="Reopened"
          value={summary.totals.reopened}
        />
        <MetricCard
          detail="Average from customer wait to first agent reply."
          icon={TimerReset}
          label="First response"
          value={formatDuration(summary.totals.averageFirstResponseSec)}
        />
        <MetricCard
          detail="Average time until conversation resolved."
          icon={Clock3}
          label="Resolution"
          value={formatDuration(summary.totals.averageResolutionSec)}
        />
        <MetricCard
          detail="SLA met over met + breached events."
          icon={BarChart3}
          label="SLA compliance"
          value={
            summary.totals.slaCompliancePct === null
              ? "No data"
              : `${summary.totals.slaCompliancePct}%`
          }
        />
        <MetricCard
          detail="Customer satisfaction, once CSAT collection is enabled."
          icon={ShieldCheck}
          label="CSAT"
          value={summary.totals.csat === null ? "No data" : summary.totals.csat}
        />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel>
          <PanelTitle
            title="Daily Work Trend"
            description="Assigned, reply, resolved, and breached counts by day."
          />

          {summary.daily.length === 0 ? (
            <div className="mt-6">
              <EmptyState>No daily metrics have been aggregated yet.</EmptyState>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {summary.daily.map((day) => {
                const total = day.assigned + day.replies + day.resolved;

                return (
                  <div key={day.date}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-semibold text-[#102040]">{day.date}</span>
                      <span className="text-[#526173]">{total} work events</span>
                    </div>
                    <div className="grid h-3 overflow-hidden rounded-full bg-[#128C7E]/10">
                      <div
                        className="col-start-1 row-start-1 h-full rounded-full bg-[#128C7E]"
                        style={{ width: `${Math.max(3, (total / maxDaily) * 100)}%` }}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#526173]">
                      <span>Assigned {day.assigned}</span>
                      <span>Replies {day.replies}</span>
                      <span>Resolved {day.resolved}</span>
                      <span>Breached {day.slaBreached}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel>
          <PanelTitle
            title="SLA Breakdown"
            description="Met versus breached events and raw SLA event counts."
          />

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[#BFE9D0] bg-emerald-50 p-4">
              <p className="text-sm text-emerald-700">Met</p>
              <p className="mt-2 text-3xl font-bold text-emerald-800">{sla.slaMet}</p>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm text-rose-700">Breached</p>
              <p className="mt-2 text-3xl font-bold text-rose-700">{sla.slaBreached}</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {sla.eventCounts.length === 0 ? (
              <EmptyState>No SLA events in this period.</EmptyState>
            ) : (
              sla.eventCounts.map((event) => (
                <div
                  key={event.type}
                  className="flex items-center justify-between rounded-2xl border border-[#BFE9D0] bg-white p-4"
                >
                  <span className="text-sm font-semibold text-[#102040]">{event.type}</span>
                  <StatusPill tone={event.type.includes("BREACHED") ? "red" : "green"}>
                    {event.count}
                  </StatusPill>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel>
          <PanelTitle
            title="Queue Comparison"
            description="Conversation work grouped by inbox queue."
          />

          {queues.length === 0 ? (
            <div className="mt-6">
              <EmptyState>No queue metrics found for this period.</EmptyState>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {queues.map((queue) => (
                <div key={queue.queue.id ?? "no-queue"}>
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <span className="font-semibold text-[#102040]">{queue.queue.name}</span>
                    <span className="text-sm text-[#526173]">{queue.assigned} assigned</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#128C7E]/10">
                    <div
                      className="h-full rounded-full bg-[#128C7E]"
                      style={{ width: `${Math.max(3, (queue.assigned / maxQueue) * 100)}%` }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#526173]">
                    <span>Replies {queue.replies}</span>
                    <span>Resolved {queue.resolved}</span>
                    <span>SLA met {queue.slaMet}</span>
                    <span>Breached {queue.slaBreached}</span>
                    <span>
                      CSAT {queue.csat === null ? "No data" : `${queue.csat}/5`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <PanelTitle
            title="Agent Performance"
            description="Agent workload, reply output, resolution, and SLA compliance."
          />

          {agents.length === 0 ? (
            <div className="mt-6">
              <EmptyState>No agent metrics found. Run the analytics worker after inbox activity.</EmptyState>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-[#526173]">
                  <tr>
                    <th className="px-3 py-3">Agent</th>
                    <th className="px-3 py-3">Replies</th>
                    <th className="px-3 py-3">Resolved</th>
                    <th className="px-3 py-3">First response</th>
                    <th className="px-3 py-3">SLA</th>
                    <th className="px-3 py-3">CSAT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#BFE9D0]">
                  {agents.map((agent) => (
                    <tr key={agent.user.id}>
                      <td className="px-3 py-4">
                        <p className="font-semibold text-[#102040]">
                          {agent.user.name ?? agent.user.email}
                        </p>
                        <p className="text-xs text-[#526173]">{agent.user.email}</p>
                      </td>
                      <td className="px-3 py-4 text-[#102040]">{agent.replies}</td>
                      <td className="px-3 py-4 text-[#102040]">{agent.resolved}</td>
                      <td className="px-3 py-4 text-[#102040]">
                        {formatDuration(agent.averageFirstResponseSec)}
                      </td>
                      <td className="px-3 py-4">
                        <StatusPill
                          tone={
                            agent.slaCompliancePct === null || agent.slaCompliancePct >= 90
                              ? "green"
                              : "amber"
                          }
                        >
                          {agent.slaCompliancePct === null
                            ? "No data"
                            : `${agent.slaCompliancePct}%`}
                        </StatusPill>
                      </td>
                      <td className="px-3 py-4">
                        <StatusPill tone={agent.csat === null || agent.csat >= 4 ? "green" : "amber"}>
                          {agent.csat === null
                            ? "No data"
                            : `${agent.csat}/5 (${agent.csatResponseCount})`}
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}
