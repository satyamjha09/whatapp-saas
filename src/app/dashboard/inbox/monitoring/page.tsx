import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Inbox,
  RadioTower,
  ShieldAlert,
  TimerReset,
  UserCheck,
  UsersRound,
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
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getInboxMonitoringDashboard } from "@/server/services/inbox-supervisor.service";

function formatDuration(seconds: number | null) {
  if (seconds === null) return "No data";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round((seconds / 3600) * 10) / 10}h`;
}

function availabilityTone(status: string) {
  if (status === "AVAILABLE") return "green" as const;
  if (status === "BUSY") return "amber" as const;
  if (status === "AWAY") return "blue" as const;
  return "zinc" as const;
}

export default async function InboxMonitoringPage({
  searchParams,
}: {
  searchParams?: Promise<{ queueId?: string }>;
}) {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const resolvedSearchParams = await searchParams;
  const monitoring = await getInboxMonitoringDashboard(
    context.membership.companyId,
    {
      queueId: resolvedSearchParams?.queueId ?? null,
    },
  );

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Inbox Monitoring"
        description="Live supervisor view for agent availability, queue backlog, SLA risk, pending approvals, and worker health."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/inbox/analytics" className={actionButtonClass("secondary")}>
              View analytics
            </Link>
            <Link href="/dashboard/inbox" className={actionButtonClass("primary")}>
              Open inbox
            </Link>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail="Open conversations across queues."
          icon={Inbox}
          label="Queue backlog"
          value={monitoring.queues.totalBacklog}
        />
        <MetricCard
          detail="Needs owner before reply."
          icon={UsersRound}
          label="Unassigned"
          value={monitoring.queues.unassignedConversations}
        />
        <MetricCard
          detail="SLA deadline within 30 minutes."
          icon={Clock3}
          label="Due soon"
          value={monitoring.sla.dueSoonConversations}
        />
        <MetricCard
          detail="Past SLA deadline or marked breached."
          icon={ShieldAlert}
          label="SLA breaches"
          value={monitoring.sla.breachedConversations}
        />
        <MetricCard
          detail="Agents ready to accept work."
          icon={UserCheck}
          label="Available agents"
          value={monitoring.agents.AVAILABLE}
        />
        <MetricCard
          detail="Replies waiting for supervisor approval."
          icon={CheckCircle2}
          label="Approval backlog"
          value={monitoring.approvals.pending}
        />
        <MetricCard
          detail="Last 30 days from stored conversation timestamps."
          icon={TimerReset}
          label="Avg first response"
          value={formatDuration(monitoring.sla.averageFirstResponseSec)}
        />
        <MetricCard
          detail="Message, webhook, SLA, and analytics workers."
          icon={RadioTower}
          label="Worker health"
          value={`${monitoring.workers.healthy}/${monitoring.workers.items.length}`}
        />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel>
          <PanelTitle
            title="Queue Backlog"
            description="Open conversations grouped by current queue."
          />

          {monitoring.queues.backlogByQueue.length === 0 ? (
            <div className="mt-6">
              <EmptyState>No open queue backlog right now.</EmptyState>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {monitoring.queues.backlogByQueue.map((queue) => {
                const pct =
                  monitoring.queues.totalBacklog === 0
                    ? 0
                    : Math.round(
                        (queue.openConversations / monitoring.queues.totalBacklog) * 100,
                      );

                return (
                  <div
                    key={queue.queueId ?? "no-queue"}
                    className="rounded-2xl border border-[#BFE9D0] bg-white p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-[#102040]">{queue.queueName}</p>
                        <p className="mt-1 text-sm text-[#526173]">
                          {queue.openConversations} open conversation(s)
                        </p>
                      </div>
                      <StatusPill tone={pct > 50 ? "amber" : "green"}>{pct}%</StatusPill>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#128C7E]/10">
                      <div
                        className="h-full rounded-full bg-[#128C7E]"
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel>
          <PanelTitle
            title="Agent Availability"
            description="Current agent presence and accepting-new status."
          />

          <div className="mt-5 grid grid-cols-2 gap-3">
            <StatusPill tone="green">Available {monitoring.agents.AVAILABLE}</StatusPill>
            <StatusPill tone="amber">Busy {monitoring.agents.BUSY}</StatusPill>
            <StatusPill tone="blue">Away {monitoring.agents.AWAY}</StatusPill>
            <StatusPill tone="zinc">Offline {monitoring.agents.OFFLINE}</StatusPill>
          </div>

          {monitoring.agents.profiles.length === 0 ? (
            <div className="mt-6">
              <EmptyState>No agent profiles configured yet.</EmptyState>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {monitoring.agents.profiles.slice(0, 8).map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-[#BFE9D0] bg-white p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#102040]">{agent.name}</p>
                    <p className="mt-1 truncate text-xs text-[#526173]">{agent.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusPill tone={availabilityTone(agent.availabilityStatus)}>
                      {agent.availabilityStatus}
                    </StatusPill>
                    {!agent.acceptingNew ? (
                      <span className="text-xs font-semibold text-amber-700">
                        Not accepting
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel>
          <PanelTitle
            title="Oldest Waiting Customer"
            description="The open conversation waiting longest since the customer message."
          />

          {monitoring.sla.oldestWaitingConversation ? (
            <Link
              href={`/dashboard/inbox/${monitoring.sla.oldestWaitingConversation.id}`}
              className="mt-6 block rounded-2xl border border-[#BFE9D0] bg-white p-5 transition hover:border-[#128C7E]/50 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-[#102040]">
                    {monitoring.sla.oldestWaitingConversation.name ?? "Unnamed contact"}
                  </p>
                  <p className="mt-1 text-sm text-[#526173]">
                    +{monitoring.sla.oldestWaitingConversation.countryCode}
                    {monitoring.sla.oldestWaitingConversation.phoneNumber}
                  </p>
                </div>
                <StatusPill tone="amber">
                  {monitoring.sla.oldestWaitingConversation.inboxPriority}
                </StatusPill>
              </div>
              <p className="mt-4 text-sm text-[#526173]">
                Waiting since{" "}
                {monitoring.sla.oldestWaitingConversation.inboxLastCustomerMessageAt?.toLocaleString()}
              </p>
            </Link>
          ) : (
            <div className="mt-6">
              <EmptyState>No customer is currently waiting.</EmptyState>
            </div>
          )}
        </Panel>

        <Panel>
          <PanelTitle
            title="Worker Status"
            description="Operational health for inbox-critical background workers."
          />

          <div className="mt-6 space-y-3">
            {monitoring.workers.items.map((worker) => (
              <div
                key={worker.workerName}
                className="flex items-center justify-between rounded-2xl border border-[#BFE9D0] bg-white p-4"
              >
                <div>
                  <p className="font-semibold text-[#102040]">{worker.workerName}</p>
                  <p className="mt-1 text-xs text-[#526173]">
                    {worker.lastHeartbeatAt
                      ? `Last heartbeat ${new Date(worker.lastHeartbeatAt).toLocaleString()}`
                      : "No heartbeat yet"}
                  </p>
                </div>
                <StatusPill tone={worker.isHealthy ? "green" : "red"}>
                  {worker.status}
                </StatusPill>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      {monitoring.workers.unhealthy > 0 || monitoring.sla.breachedConversations > 0 ? (
        <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              Supervisor attention needed: review breached conversations and worker health
              before starting heavy outbound or automation work.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
