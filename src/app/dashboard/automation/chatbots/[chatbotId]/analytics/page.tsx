import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  GitBranch,
  MessageCircleReply,
  MousePointerClick,
  Target,
  UserCheck,
  UsersRound,
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
import { getChatbotAnalytics } from "@/server/services/chatbot.service";

type ChatbotAnalyticsPageProps = {
  params: Promise<{
    chatbotId: string;
  }>;
};

type RetargetContact = {
  contactId: string;
  currentNodeName: string | null;
  currentNodeType: string | null;
  lastInteractionAt: Date;
  lifecycleStage: string;
  name: string | null;
  phone: string;
  reason: string;
  sessionId: string;
  status: string;
};

function percent(bps: number) {
  return `${(bps / 100).toFixed(1)}%`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(date);
}

function formatType(value: string) {
  return value.replaceAll("_", " ");
}

function phoneList(contacts: RetargetContact[]) {
  return contacts.map((contact) => contact.phone).join(", ");
}

function SegmentPanel({
  chatbotId,
  contacts,
  description,
  title,
}: {
  chatbotId: string;
  contacts: RetargetContact[];
  description: string;
  title: string;
}) {
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PanelTitle title={title} description={description} />
        <StatusPill tone={contacts.length > 0 ? "green" : "zinc"}>
          {contacts.length.toLocaleString("en-IN")} users
        </StatusPill>
      </div>

      {contacts.length === 0 ? (
        <div className="mt-5">
          <EmptyState>No users in this segment yet.</EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-5 rounded-xl border border-[#BFE9D0] bg-[#F7FBFF] p-3">
            <p className="text-xs font-semibold uppercase text-[#128C7E]">
              Phone list
            </p>
            <p className="mt-2 break-words text-sm leading-6 text-[#081B3A]">
              {phoneList(contacts)}
            </p>
          </div>
          <div className="mt-4 space-y-3">
            {contacts.slice(0, 6).map((contact) => (
              <div
                className="rounded-xl border border-[#BFE9D0] bg-white p-3"
                key={`${title}-${contact.contactId}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#081B3A]">
                      {contact.name ?? "Unnamed contact"}
                    </p>
                    <p className="mt-1 text-xs text-[#526173]">
                      {contact.phone} - {contact.reason}
                    </p>
                  </div>
                  <StatusPill tone={statusTone(contact.status)}>
                    {contact.status}
                  </StatusPill>
                </div>
                <p className="mt-2 text-xs text-[#526173]">
                  {contact.currentNodeName
                    ? `${contact.currentNodeName} (${formatType(
                        contact.currentNodeType ?? "NODE",
                      )})`
                    : contact.lifecycleStage}{" "}
                  - {formatDate(contact.lastInteractionAt)}
                </p>
                <Link
                  className="mt-3 inline-flex items-center rounded-lg border border-[#BFE9D0] px-3 py-2 text-xs font-semibold text-[#128C7E] transition hover:bg-[#E7F8EF]"
                  href={`/dashboard/automation/chatbots/${chatbotId}/sessions/${contact.sessionId}`}
                >
                  View session
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

export default async function ChatbotAnalyticsPage({
  params,
}: ChatbotAnalyticsPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const { chatbotId } = await params;
  const analytics = await getChatbotAnalytics({
    chatbotId,
    companyId: context.membership.companyId,
  });

  if (!analytics) notFound();

  const { metrics } = analytics;
  const segments = [
    {
      contacts: analytics.retargeting.droppedUsers,
      description:
        "Users waiting at a node or abandoned before finishing the journey.",
      title: "Dropped users",
    },
    {
      contacts: analytics.retargeting.productUsers,
      description:
        "Users who reached a catalog product-card path. Trackable product URLs can make this exact later.",
      title: "Product interest",
    },
    {
      contacts: analytics.retargeting.priceIntentUsers,
      description:
        "Replies containing price, rate, amount, payment, or similar buying intent words.",
      title: "Asked price",
    },
    {
      contacts: analytics.retargeting.salesAssignedUsers,
      description:
        "Users handed off by Assign Agent nodes or active sales/support assignment.",
      title: "Assigned to sales",
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Chatbot Analytics"
        description={`${analytics.chatbot.name} - ${analytics.chatbot.description ?? "results, drop-offs, replies, and retargeting segments"}`}
        actions={
          <Link
            className={actionButtonClass("secondary")}
            href={`/dashboard/automation/chatbots/${chatbotId}/builder`}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Builder
          </Link>
        }
      />

      <section className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={UsersRound}
          label="Started users"
          value={metrics.startedUsers.toLocaleString("en-IN")}
          detail={`${metrics.totalSessions.toLocaleString("en-IN")} total session(s)`}
        />
        <MetricCard
          icon={CheckCircle2}
          label="Completed users"
          value={metrics.completedUsers.toLocaleString("en-IN")}
          detail={`${percent(metrics.completionRateBps)} session completion`}
        />
        <MetricCard
          icon={MessageCircleReply}
          label="Replied users"
          value={metrics.repliedUsers.toLocaleString("en-IN")}
          detail="Any inbound reply inside a chatbot session"
        />
        <MetricCard
          icon={MousePointerClick}
          label="Button clicks"
          value={metrics.buttonClicks.toLocaleString("en-IN")}
          detail="Quick reply, list, and media button replies"
        />
      </section>

      <section className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={UserCheck}
          label="Assigned to agent"
          value={metrics.assignedToAgent.toLocaleString("en-IN")}
        />
        <MetricCard
          icon={Target}
          label="Converted leads"
          value={metrics.convertedLeads.toLocaleString("en-IN")}
          detail="Completed flow or qualified customer stage"
        />
        <MetricCard
          icon={GitBranch}
          label="Completed sessions"
          value={metrics.completedSessions.toLocaleString("en-IN")}
        />
        <MetricCard
          icon={Bot}
          label="Chatbot status"
          value={analytics.chatbot.status}
        />
      </section>

      <section className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel>
          <PanelTitle
            title="Drop-off nodes"
            description="Where users are currently waiting or where abandoned sessions ended."
          />

          {analytics.dropOffNodes.length === 0 ? (
            <div className="mt-5">
              <EmptyState>No drop-off nodes yet.</EmptyState>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {analytics.dropOffNodes.map((node) => (
                <div
                  className="rounded-xl border border-[#BFE9D0] bg-white p-4"
                  key={node.nodeId ?? "unknown"}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#081B3A]">
                        {node.nodeLabel}
                      </p>
                      <p className="mt-1 text-xs text-[#526173]">
                        {formatType(node.nodeType)}
                      </p>
                    </div>
                    <StatusPill tone="amber">
                      {node.count.toLocaleString("en-IN")} dropped
                    </StatusPill>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E7F8EF]">
                    <div
                      className="h-full rounded-full bg-[#128C7E]"
                      style={{
                        width: `${Math.min(100, node.rateBps / 100)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-[#526173]">
                    {percent(node.rateBps)} of all sessions
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <PanelTitle
            title="Retargeting summary"
            description="Fast view of audiences you can send follow-up campaigns to."
          />
          <div className="mt-5 space-y-3">
            {segments.map((segment) => (
              <div
                className="rounded-xl border border-[#BFE9D0] bg-[#F7FBFF] p-4"
                key={segment.title}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-[#081B3A]">
                    {segment.title}
                  </p>
                  <StatusPill tone={segment.contacts.length ? "green" : "zinc"}>
                    {segment.contacts.length}
                  </StatusPill>
                </div>
                <p className="mt-2 text-xs leading-5 text-[#526173]">
                  {segment.description}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        {segments.map((segment) => (
          <SegmentPanel
            chatbotId={chatbotId}
            contacts={segment.contacts}
            description={segment.description}
            key={segment.title}
            title={segment.title}
          />
        ))}
      </section>
    </div>
  );
}
