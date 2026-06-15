import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Inbox,
  MailOpen,
  MessageCircle,
  ShieldAlert,
  UserRoundX,
} from "lucide-react";
import { redirect } from "next/navigation";
import {
  EmptyState,
  PageHeader,
  Panel,
  PanelTitle,
  StatusPill,
  actionButtonClass,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getInboxAnalytics } from "@/server/services/inbox-analytics.service";
import { getPriorityColorClass } from "../priority-color";
import SlaBadge from "../sla-badge";
import StatCard from "./stat-card";

export default async function InboxAnalyticsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const analytics = await getInboxAnalytics(context.membership.companyId);

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Inbox Analytics"
        description="Support command center for SLA health, breached conversations, unread customer messages, priority mix, and team workload."
        actions={
          <Link href="/dashboard/inbox" className={actionButtonClass("secondary")}>
            Back to inbox
          </Link>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Inbox}
          title="Open conversations"
          value={analytics.summary.openConversations}
          description="Conversations currently active."
        />
        <StatCard
          icon={MailOpen}
          title="Unread messages"
          value={analytics.summary.unreadMessages}
          description="Inbound messages not read internally."
        />
        <StatCard
          icon={ShieldAlert}
          title="SLA breached"
          value={analytics.summary.breachedConversations}
          description="Open conversations with breached SLA."
        />
        <StatCard
          icon={Clock3}
          title="Due soon"
          value={analytics.summary.dueSoonConversations}
          description="SLA due within the next 30 minutes."
        />
        <StatCard
          icon={AlertTriangle}
          title="Overdue"
          value={analytics.summary.overdueConversations}
          description="Past due but not marked breached yet."
        />
        <StatCard
          icon={UserRoundX}
          title="Unassigned"
          value={analytics.summary.unassignedOpenConversations}
          description="Open conversations without an owner."
        />
        <StatCard
          icon={CheckCircle2}
          title="Closed"
          value={analytics.summary.closedConversations}
          description="Resolved conversations."
        />
        <StatCard
          icon={MessageCircle}
          title="Total"
          value={analytics.summary.totalConversations}
          description="All conversations with messages."
        />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelTitle
            title="Priority Breakdown"
            description="Conversation count grouped by current priority."
          />

          <div className="mt-6 space-y-3">
            {(["URGENT", "HIGH", "NORMAL", "LOW"] as const).map((priority) => (
              <div
                key={priority}
                className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4"
              >
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${getPriorityColorClass(
                    priority,
                  )}`}
                >
                  {priority}
                </span>
                <span className="text-sm font-semibold text-white">
                  {analytics.priorityCounts[priority]} conversation(s)
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelTitle
            title="Agent Workload"
            description="Open conversation load by assigned teammate."
          />

          {analytics.agentWorkload.length === 0 ? (
            <div className="mt-6">
              <EmptyState>No open assigned conversations yet.</EmptyState>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {analytics.agentWorkload.map((agent) => (
                <div
                  key={agent.assignedToUserId ?? "unassigned"}
                  className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4"
                >
                  <div>
                    <p className="font-semibold text-white">{agent.name}</p>
                    {agent.email ? (
                      <p className="mt-1 text-xs text-zinc-500">{agent.email}</p>
                    ) : null}
                  </div>

                  <StatusPill tone={agent.assignedToUserId ? "blue" : "amber"}>
                    {agent.openConversationCount} open
                  </StatusPill>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel>
          <div className="flex items-center justify-between gap-4">
            <PanelTitle
              title="Recent SLA Breaches"
              description="Newest breached conversations requiring attention."
            />
            <Link
              href="/dashboard/inbox?sla=breached"
              className="text-sm font-medium text-indigo-300 transition hover:text-indigo-200"
            >
              View all
            </Link>
          </div>

          {analytics.recentBreachedConversations.length === 0 ? (
            <div className="mt-6">
              <EmptyState>No breached conversations.</EmptyState>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {analytics.recentBreachedConversations.map((contact) => {
                const latestMessage = contact.messages[0];

                return (
                  <Link
                    key={contact.id}
                    href={`/dashboard/inbox/${contact.id}`}
                    className="block rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 transition hover:border-indigo-300/25 hover:bg-white/[0.06]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">
                          {contact.name ?? "Unnamed Contact"}
                        </p>
                        <p className="mt-1 text-sm text-zinc-500">
                          +{contact.countryCode}
                          {contact.phoneNumber}
                        </p>
                        {contact.assignedTo ? (
                          <p className="mt-1 text-xs text-zinc-500">
                            Assigned to:{" "}
                            {contact.assignedTo.name ?? contact.assignedTo.email}
                          </p>
                        ) : null}
                      </div>

                      <SlaBadge
                        inboxStatus={contact.inboxStatus}
                        inboxSlaDueAt={contact.inboxSlaDueAt}
                        inboxSlaBreachedAt={contact.inboxSlaBreachedAt}
                      />
                    </div>

                    {latestMessage ? (
                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-400">
                        {latestMessage.body}
                      </p>
                    ) : null}

                    {contact.inboxSlaBreachedAt ? (
                      <p className="mt-2 text-xs text-zinc-600">
                        Breached: {contact.inboxSlaBreachedAt.toLocaleString()}
                      </p>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel>
          <div className="flex items-center justify-between gap-4">
            <PanelTitle
              title="Next Conversations To Handle"
              description="Open conversations ordered by SLA due date."
            />
            <Link
              href="/dashboard/inbox"
              className="text-sm font-medium text-indigo-300 transition hover:text-indigo-200"
            >
              Open inbox
            </Link>
          </div>

          {analytics.latestOpenConversations.length === 0 ? (
            <div className="mt-6">
              <EmptyState>No open conversations right now.</EmptyState>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {analytics.latestOpenConversations.map((contact) => {
                const latestMessage = contact.messages[0];

                return (
                  <Link
                    key={contact.id}
                    href={`/dashboard/inbox/${contact.id}`}
                    className="block rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 transition hover:border-indigo-300/25 hover:bg-white/[0.06]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">
                          {contact.name ?? "Unnamed Contact"}
                        </p>
                        <p className="mt-1 text-sm text-zinc-500">
                          +{contact.countryCode}
                          {contact.phoneNumber}
                        </p>
                        {contact.assignedTo ? (
                          <p className="mt-1 text-xs text-zinc-500">
                            Assigned to:{" "}
                            {contact.assignedTo.name ?? contact.assignedTo.email}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${getPriorityColorClass(
                            contact.inboxPriority,
                          )}`}
                        >
                          {contact.inboxPriority}
                        </span>
                        <SlaBadge
                          inboxStatus={contact.inboxStatus}
                          inboxSlaDueAt={contact.inboxSlaDueAt}
                          inboxSlaBreachedAt={contact.inboxSlaBreachedAt}
                        />
                      </div>
                    </div>

                    {latestMessage ? (
                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-400">
                        {latestMessage.body}
                      </p>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}
