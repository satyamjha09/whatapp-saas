import { Activity, Bot, Plus, Workflow } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  actionButtonClass,
  EmptyState,
  MetricCard,
  PageHeader,
  Panel,
  PanelTitle,
  StatusPill,
  statusTone,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  getChatbotFoundationStats,
  getChatbotsByCompany,
} from "@/server/services/chatbot.service";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default async function ChatbotsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const companyId = context.membership.companyId;
  const [chatbots, stats] = await Promise.all([
    getChatbotsByCompany(companyId),
    getChatbotFoundationStats(companyId),
  ]);
  const canManage = ["OWNER", "ADMIN"].includes(context.membership.role);

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Chatbots"
        description="Build WhatsApp automation foundations with versions, triggers, sessions, and execution events."
        actions={
          canManage ? (
            <Link
              className={actionButtonClass()}
              href="/dashboard/automation/chatbots/new"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Chatbot
            </Link>
          ) : null
        }
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail={`${stats.draft} draft, ${stats.published} published, ${stats.paused} paused`}
          icon={Bot}
          label="Chatbots"
          value={stats.total.toLocaleString("en-IN")}
        />
        <MetricCard
          icon={Workflow}
          label="Draft versions"
          value={chatbots
            .reduce((total, chatbot) => total + chatbot._count.versions, 0)
            .toLocaleString("en-IN")}
        />
        <MetricCard
          icon={Activity}
          label="Active sessions"
          value={stats.activeSessions.toLocaleString("en-IN")}
        />
        <MetricCard
          icon={Plus}
          label="Triggers"
          value={chatbots
            .reduce((total, chatbot) => total + chatbot._count.triggers, 0)
            .toLocaleString("en-IN")}
        />
      </section>

      <Panel className="overflow-hidden p-0 sm:p-0">
        <div className="border-b border-[#BFE9D0] px-5 py-4 sm:px-6">
          <PanelTitle
            title="Automation flows"
            description="Open a chatbot to edit its draft builder foundation."
          />
        </div>

        {chatbots.length === 0 ? (
          <div className="p-5 sm:p-6">
            <EmptyState>No chatbots created yet.</EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-[#E7F8EF] text-xs uppercase text-[#526173]">
                <tr>
                  <th className="px-5 py-3">Chatbot</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Versions</th>
                  <th className="px-5 py-3">Triggers</th>
                  <th className="px-5 py-3">Sessions</th>
                  <th className="px-5 py-3">Updated</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#BFE9D0]">
                {chatbots.map((chatbot) => (
                  <tr key={chatbot.id}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#E7F8EF] text-[#128C7E]">
                          <Bot className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#081B3A]">
                            {chatbot.name}
                          </p>
                          <p className="line-clamp-1 text-xs text-[#526173]">
                            {chatbot.description ?? "No description"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill tone={statusTone(chatbot.status)}>
                        {chatbot.status}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-4 text-[#526173]">
                      {chatbot._count.versions}
                    </td>
                    <td className="px-5 py-4 text-[#526173]">
                      {chatbot._count.triggers}
                    </td>
                    <td className="px-5 py-4 text-[#526173]">
                      {chatbot._count.sessions}
                    </td>
                    <td className="px-5 py-4 text-[#526173]">
                      {formatDate(chatbot.updatedAt)}
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        className="font-semibold text-[#128C7E] hover:underline"
                        href={`/dashboard/automation/chatbots/${chatbot.id}/builder`}
                      >
                        Builder
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
