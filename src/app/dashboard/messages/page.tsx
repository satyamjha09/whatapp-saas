import Link from "next/link";
import { Inbox, Send, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import {
  EmptyState,
  MetricCard,
  PageHeader,
  Panel,
  PanelTitle,
  StatusPill,
  statusTone,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getContactsByCompany } from "@/server/services/contact.service";
import { getMessagesByCompany } from "@/server/services/message.service";
import { getTemplatesByCompany } from "@/server/services/template.service";
import SendMessageForm from "./send-message-form";

export default async function MessagesPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const companyId = context.membership.companyId;

  const [contacts, templates, messages] = await Promise.all([
    getContactsByCompany(companyId),
    getTemplatesByCompany(companyId),
    getMessagesByCompany(companyId),
  ]);

  const outbound = messages.filter((message) => message.direction === "OUTBOUND");
  const inbound = messages.filter((message) => message.direction === "INBOUND");
  const delivered = messages.filter((message) =>
    ["SENT", "DELIVERED", "READ"].includes(message.status),
  );

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Messages"
        description="Queue template messages and review the real message history recorded for this workspace."
      />

      {contacts.length === 0 || templates.length === 0 ? (
        <div className="mb-6 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-5 text-sm text-amber-200">
          Before sending a message, create at least one contact and one
          template.
        </div>
      ) : null}

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          icon={Send}
          label="Outbound"
          value={outbound.length.toLocaleString("en-IN")}
          detail="Messages sent or queued"
        />
        <MetricCard
          icon={Inbox}
          label="Inbound"
          value={inbound.length.toLocaleString("en-IN")}
          detail="Received customer messages"
        />
        <MetricCard
          icon={ShieldCheck}
          label="Sent or delivered"
          value={delivered.length.toLocaleString("en-IN")}
          detail="Successful outbound states"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <SendMessageForm contacts={contacts} templates={templates} />

        <Panel>
          <PanelTitle
            title="Message history"
            description="Latest stored messages with status and template context."
          />

          {messages.length === 0 ? (
            <div className="mt-6">
              <EmptyState>No messages queued yet.</EmptyState>
            </div>
          ) : (
            <div className="mt-6 grid gap-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 transition hover:border-indigo-300/25 hover:bg-white/[0.06]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-white">
                        {message.contact.name ?? "Unnamed Contact"}
                      </h3>
                      <p className="mt-1 text-sm text-zinc-500">
                        To: +{message.toPhoneNumber}
                      </p>
                    </div>

                    <StatusPill tone={statusTone(message.status)}>
                      {message.status}
                    </StatusPill>
                  </div>

                  <p className="mt-4 whitespace-pre-wrap rounded-2xl border border-white/[0.06] bg-zinc-950/45 p-4 text-sm leading-6 text-zinc-300">
                    {message.body}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-500">
                    <span>
                      Template: {message.template?.name ?? "Deleted template"}
                    </span>
                    <span>-</span>
                    <span>Created: {message.createdAt.toLocaleDateString()}</span>
                  </div>

                  <div className="mt-4">
                    <Link
                      href={`/dashboard/messages/${message.id}`}
                      className="text-sm font-medium text-indigo-300 transition hover:text-indigo-200"
                    >
                      View details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
