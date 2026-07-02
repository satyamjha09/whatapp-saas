import { ArrowLeft, Bot, Clock, MessageSquare, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  actionButtonClass,
  EmptyState,
  PageHeader,
  Panel,
  PanelTitle,
  StatusPill,
  statusTone,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getChatbotSessionLog } from "@/server/services/chatbot.service";

type ChatbotSessionLogPageProps = {
  params: Promise<{
    chatbotId: string;
    sessionId: string;
  }>;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    second: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatType(value: string) {
  return value.replaceAll("_", " ");
}

function payloadText(value: unknown) {
  if (!value) return "No payload";

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function eventTone(eventType: string): "zinc" | "green" | "blue" | "amber" | "red" | "violet" {
  if (eventType.includes("FAILED")) return "red";
  if (eventType.includes("WAIT") || eventType.includes("STARTED")) return "amber";
  if (eventType.includes("COMPLETED")) return "green";
  if (eventType.includes("MESSAGE")) return "blue";
  return "zinc";
}

export default async function ChatbotSessionLogPage({
  params,
}: ChatbotSessionLogPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const { chatbotId, sessionId } = await params;
  const session = await getChatbotSessionLog({
    chatbotId,
    companyId: context.membership.companyId,
    sessionId,
  });

  if (!session) notFound();

  const failedEvents = session.events.filter((event) =>
    event.eventType.includes("FAILED"),
  );
  const nodeEvents = session.events.filter((event) => event.node);
  const messageEvents = session.events.filter((event) => event.message);
  const contactLabel = session.contact
    ? `${session.contact.name ?? "Unnamed"} (+${session.contact.countryCode}${session.contact.phoneNumber})`
    : "Unknown contact";

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Session Logs"
        description={`${session.chatbot.name} - ${contactLabel}`}
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

      <section className="mb-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-[#BFE9D0] bg-white p-4 shadow-[0_14px_34px_rgba(8,27,58,0.07)]">
          <p className="text-xs text-[#526173]">Status</p>
          <div className="mt-2">
            <StatusPill tone={statusTone(session.status)}>
              {session.status}
            </StatusPill>
          </div>
        </div>
        <div className="rounded-2xl border border-[#BFE9D0] bg-white p-4 shadow-[0_14px_34px_rgba(8,27,58,0.07)]">
          <p className="text-xs text-[#526173]">Events</p>
          <p className="mt-2 text-xl font-bold text-[#081B3A]">
            {session.events.length.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="rounded-2xl border border-[#BFE9D0] bg-white p-4 shadow-[0_14px_34px_rgba(8,27,58,0.07)]">
          <p className="text-xs text-[#526173]">Current node</p>
          <p className="mt-2 text-sm font-bold text-[#081B3A]">
            {session.currentNode?.name ?? "None"}
          </p>
        </div>
        <div className="rounded-2xl border border-[#BFE9D0] bg-white p-4 shadow-[0_14px_34px_rgba(8,27,58,0.07)]">
          <p className="text-xs text-[#526173]">Version</p>
          <p className="mt-2 text-sm font-bold text-[#081B3A]">
            v{session.version?.versionNumber ?? "-"}
          </p>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel>
          <PanelTitle
            title="Event timeline"
            description="Complete runtime history for this session."
          />

          {session.events.length === 0 ? (
            <div className="mt-5">
              <EmptyState>No events recorded.</EmptyState>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {session.events.map((event) => (
                <article
                  className="rounded-2xl border border-[#BFE9D0] bg-white p-4"
                  key={event.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={eventTone(event.eventType)}>
                          {formatType(event.eventType)}
                        </StatusPill>
                        {event.node ? (
                          <span className="text-xs font-semibold text-[#526173]">
                            {event.node.name} ({formatType(event.node.type)})
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs text-[#526173]">
                        {formatDate(event.createdAt)}
                      </p>
                    </div>
                    {event.message ? (
                      <StatusPill tone={statusTone(event.message.status)}>
                        {event.message.status}
                      </StatusPill>
                    ) : null}
                  </div>

                  {event.message ? (
                    <div className="mt-4 rounded-xl bg-[#F7FBFF] p-3">
                      <p className="text-xs font-semibold uppercase text-[#128C7E]">
                        Message
                      </p>
                      <p className="mt-2 text-sm text-[#081B3A]">
                        {event.message.body}
                      </p>
                      <p className="mt-2 break-words text-xs text-[#526173]">
                        {event.message.direction} to {event.message.toPhoneNumber}
                      </p>
                      {event.message.metaMessageId ? (
                        <p className="mt-1 break-words text-xs text-[#526173]">
                          Meta: {event.message.metaMessageId}
                        </p>
                      ) : null}
                      {event.message.errorMessage ? (
                        <p className="mt-1 text-xs text-rose-700">
                          {event.message.errorMessage}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <pre className="mt-4 max-h-64 overflow-auto rounded-xl bg-[#081B3A] p-3 text-xs leading-5 text-white">
                    {payloadText(event.payload)}
                  </pre>
                </article>
              ))}
            </div>
          )}
        </Panel>

        <aside className="space-y-5">
          <Panel>
            <PanelTitle
              title="Node execution"
              description="Only events attached to nodes."
            />
            <div className="mt-5 space-y-3">
              {nodeEvents.length === 0 ? (
                <EmptyState>No node events yet.</EmptyState>
              ) : (
                nodeEvents.map((event) => (
                  <div
                    className="rounded-xl border border-[#BFE9D0] p-3"
                    key={event.id}
                  >
                    <div className="flex items-start gap-3">
                      <Bot className="mt-0.5 h-4 w-4 text-[#128C7E]" />
                      <div>
                        <p className="text-sm font-semibold text-[#081B3A]">
                          {event.node?.name ?? "Unknown node"}
                        </p>
                        <p className="mt-1 text-xs text-[#526173]">
                          {formatType(event.eventType)}
                        </p>
                        <p className="mt-1 text-xs text-[#526173]">
                          {formatDate(event.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel>
            <PanelTitle
              title="Failed node logs"
              description="Failure events with attached node context."
            />
            <div className="mt-5 space-y-3">
              {failedEvents.length === 0 ? (
                <EmptyState>No failures recorded.</EmptyState>
              ) : (
                failedEvents.map((event) => (
                  <div
                    className="rounded-xl border border-rose-200 bg-rose-50 p-3"
                    key={event.id}
                  >
                    <div className="flex items-start gap-3">
                      <TriangleAlert className="mt-0.5 h-4 w-4 text-rose-700" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-rose-700">
                          {event.node?.name ?? "Runtime failure"}
                        </p>
                        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-rose-700">
                          {payloadText(event.payload)}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel>
            <PanelTitle
              title="Messages"
              description="Messages created by this chatbot session."
            />
            <div className="mt-5 space-y-3">
              {messageEvents.length === 0 ? (
                <EmptyState>No message events yet.</EmptyState>
              ) : (
                messageEvents.map((event) => (
                  <div
                    className="rounded-xl border border-[#BFE9D0] p-3"
                    key={event.id}
                  >
                    <div className="flex items-start gap-3">
                      <MessageSquare className="mt-0.5 h-4 w-4 text-[#128C7E]" />
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold text-[#081B3A]">
                          {event.message?.body ?? "Message"}
                        </p>
                        <p className="mt-1 text-xs text-[#526173]">
                          {event.message?.status ?? "UNKNOWN"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel>
            <PanelTitle title="Timing" />
            <div className="mt-5 space-y-3 text-sm text-[#526173]">
              <p className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#128C7E]" />
                Started {formatDate(session.startedAt)}
              </p>
              <p>Last interaction {formatDate(session.lastInteractionAt)}</p>
              {session.completedAt ? (
                <p>Completed {formatDate(session.completedAt)}</p>
              ) : null}
              {session.handoffAt ? (
                <p>Handoff {formatDate(session.handoffAt)}</p>
              ) : null}
            </div>
          </Panel>
        </aside>
      </section>
    </div>
  );
}
