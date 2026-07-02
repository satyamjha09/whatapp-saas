import {
  ArrowLeft,
  BarChart3,
  Cable,
  Eye,
  Radio,
  Trash2,
} from "lucide-react";
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
import { getChatbotBuilder } from "@/server/services/chatbot.service";
import {
  deleteChatbotEdgeAction,
  deleteChatbotNodeAction,
  deleteChatbotTriggerAction,
  updateChatbotStatusAction,
} from "../../actions";
import {
  ChatbotEdgeCreateForm,
  ChatbotFallbackForm,
  ChatbotNodeCreateForm,
  ChatbotTriggerCreateForm,
  ChatbotWhatsAppTestForm,
} from "./simple-builder-forms";
import ChatbotFlowCanvas from "./chatbot-flow-canvas";

type ChatbotBuilderPageProps = {
  params: Promise<{
    chatbotId: string;
  }>;
};

const nodeTone: Record<string, string> = {
  API_CALL: "bg-blue-50 text-blue-700 ring-blue-200",
  ASSIGN_AGENT: "bg-amber-50 text-amber-700 ring-amber-200",
  AI_REPLY: "bg-violet-50 text-violet-700 ring-violet-200",
  CATALOG_PRODUCT_CARD: "bg-teal-50 text-teal-700 ring-teal-200",
  CONDITION: "bg-purple-50 text-purple-700 ring-purple-200",
  END: "bg-rose-50 text-rose-700 ring-rose-200",
  GOOGLE_SHEET_SAVE: "bg-green-50 text-green-700 ring-green-200",
  LIST_MENU: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  MEDIA_BUTTONS: "bg-lime-50 text-lime-700 ring-lime-200",
  MESSAGE: "bg-[#E7F8EF] text-[#128C7E] ring-[#BFE9D0]",
  PAYMENT_LINK: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  QUESTION: "bg-orange-50 text-orange-700 ring-orange-200",
  QUICK_REPLY: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  START: "bg-[#E7F8EF] text-[#128C7E] ring-[#BFE9D0]",
  TALLY_INVOICE_LOOKUP: "bg-sky-50 text-sky-700 ring-sky-200",
  TALLY_LEDGER_BALANCE: "bg-sky-50 text-sky-700 ring-sky-200",
  WEBHOOK: "bg-indigo-50 text-indigo-700 ring-indigo-200",
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatType(value: string) {
  return value.replaceAll("_", " ");
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function getFallbackMessage(metadata: unknown) {
  const record = jsonRecord(metadata);
  return typeof record.fallbackMessage === "string"
    ? record.fallbackMessage
    : null;
}

function configSummary(node: { config: unknown; type: string }) {
  const config = jsonRecord(node.config);

  if (node.type === "MESSAGE") {
    return typeof config.body === "string" ? config.body : "No message text";
  }

  if (node.type === "QUICK_REPLY") {
    const buttons = stringArray(config.buttons);

    return buttons.length > 0
      ? `Buttons: ${buttons.join(", ")}`
      : "No buttons";
  }

  if (node.type === "LIST_MENU") {
    const sections = Array.isArray(config.sections) ? config.sections : [];
    const rowCount = sections.reduce((total, section) => {
      const record = jsonRecord(section);
      return total + (Array.isArray(record.rows) ? record.rows.length : 0);
    }, 0);

    return `${String(config.primaryButton ?? "View options")} - ${rowCount} row(s)`;
  }

  if (node.type === "MEDIA_BUTTONS") {
    const buttons = stringArray(config.buttons);
    const mediaType = String(config.headerMediaType ?? "media");

    return `${mediaType} with ${buttons.length} button(s)`;
  }

  if (node.type === "QUESTION") {
    return `Save answer as ${String(config.saveAs ?? "answer")}`;
  }

  if (node.type === "CONDITION") {
    return `${String(config.field ?? "last_reply")} ${String(
      config.operator ?? "equals",
    )} ${String(config.value ?? "")}`.trim();
  }

  if (node.type === "ASSIGN_AGENT") {
    return `Assign to ${String(config.assignTo ?? "agent")}`;
  }

  if (node.type === "API_CALL") {
    return `${String(config.method ?? "POST")} ${String(config.url ?? "")}`;
  }

  if (node.type === "WEBHOOK") {
    return `${String(config.method ?? "POST")} ${String(config.url ?? "")}`;
  }

  if (node.type === "GOOGLE_SHEET_SAVE") {
    return `Save to ${String(config.url ?? "Google Sheet")}`;
  }

  if (node.type === "TALLY_INVOICE_LOOKUP") {
    return `Lookup invoice by ${String(config.searchField ?? "last_reply")}`;
  }

  if (node.type === "TALLY_LEDGER_BALANCE") {
    return `Lookup ledger by ${String(config.searchField ?? "last_reply")}`;
  }

  if (node.type === "CATALOG_PRODUCT_CARD") {
    return `${String(config.productTitle ?? "Product")} ${String(
      config.productRetailerId ?? "",
    )}`.trim();
  }

  if (node.type === "PAYMENT_LINK") {
    return `${String(config.amount ?? "Payment")} - ${String(
      config.paymentLinkUrl ?? "",
    )}`.trim();
  }

  if (node.type === "AI_REPLY") {
    return `Prompt: ${String(config.prompt ?? "").slice(0, 80)}`;
  }

  return typeof config.description === "string"
    ? config.description
    : "System node";
}

export default async function ChatbotBuilderPage({
  params,
}: ChatbotBuilderPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const { chatbotId } = await params;
  const chatbot = await getChatbotBuilder({
    chatbotId,
    companyId: context.membership.companyId,
  });

  if (!chatbot) notFound();

  const version = chatbot.draftVersion;
  const nodes = version?.nodes ?? [];
  const edges = version?.edges ?? [];
  const fallbackMessage = getFallbackMessage(chatbot.metadata);
  const simpleNodes = nodes.map((node) => ({
    id: node.id,
    name: node.name,
    type: node.type,
  }));
  const canvasNodes = nodes.map((node) => ({
    configSummary: configSummary(node),
    id: node.id,
    name: node.name,
    nodeKey: node.nodeKey,
    positionX: node.positionX,
    positionY: node.positionY,
    type: node.type,
  }));
  const canvasEdges = edges.map((edge) => ({
    id: edge.id,
    label: edge.label,
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
  }));

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title={chatbot.name}
        description={chatbot.description ?? "No-code WhatsApp chatbot foundation"}
        actions={
          <>
            <form action={updateChatbotStatusAction}>
              <input name="chatbotId" type="hidden" value={chatbot.id} />
              <input
                name="status"
                type="hidden"
                value={chatbot.status === "PUBLISHED" ? "PAUSED" : "PUBLISHED"}
              />
              <button className={actionButtonClass()} type="submit">
                {chatbot.status === "PUBLISHED" ? "Pause" : "Publish"}
              </button>
            </form>
            <Link
              className={actionButtonClass("secondary")}
              href={`/dashboard/automation/chatbots/${chatbot.id}/analytics`}
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Analytics
            </Link>
            <Link
              className={actionButtonClass("secondary")}
              href={`/dashboard/automation/chatbots/${chatbot.id}/preview`}
            >
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Link>
            <Link
              className={actionButtonClass("secondary")}
              href="/dashboard/automation/chatbots"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Chatbots
            </Link>
          </>
        }
      />

      <section className="mb-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-[#BFE9D0] bg-white p-4 shadow-[0_14px_34px_rgba(8,27,58,0.07)]">
          <p className="text-xs text-[#526173]">Status</p>
          <div className="mt-2">
            <StatusPill tone={statusTone(chatbot.status)}>
              {chatbot.status}
            </StatusPill>
          </div>
        </div>
        <div className="rounded-2xl border border-[#BFE9D0] bg-white p-4 shadow-[0_14px_34px_rgba(8,27,58,0.07)]">
          <p className="text-xs text-[#526173]">Draft version</p>
          <p className="mt-2 text-xl font-bold text-[#081B3A]">
            v{version?.versionNumber ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-[#BFE9D0] bg-white p-4 shadow-[0_14px_34px_rgba(8,27,58,0.07)]">
          <p className="text-xs text-[#526173]">Nodes</p>
          <p className="mt-2 text-xl font-bold text-[#081B3A]">
            {nodes.length.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="rounded-2xl border border-[#BFE9D0] bg-white p-4 shadow-[0_14px_34px_rgba(8,27,58,0.07)]">
          <p className="text-xs text-[#526173]">Sessions</p>
          <p className="mt-2 text-xl font-bold text-[#081B3A]">
            {chatbot._count.sessions.toLocaleString("en-IN")}
          </p>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Panel className="overflow-hidden p-0 sm:p-0">
          <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
            <PanelTitle
              title="Visual flow builder"
              description="Create the WhatsApp journey on a draggable workflow canvas."
            />
            <span className="inline-flex items-center rounded-xl bg-[#E7F8EF] px-3 py-2 text-xs font-semibold text-[#128C7E]">
              {nodes.length.toLocaleString("en-IN")} nodes
            </span>
          </div>

          {nodes.length === 0 ? (
            <div className="px-5 pb-5 sm:px-6 sm:pb-6">
              <EmptyState>No nodes in this version yet.</EmptyState>
            </div>
          ) : (
            <div className="px-5 pb-5 sm:px-6 sm:pb-6">
              <ChatbotFlowCanvas
                chatbotId={chatbot.id}
                edges={canvasEdges}
                nodes={canvasNodes}
              />
            </div>
          )}

          <div className="border-t border-[#BFE9D0] bg-[#E7F8EF] p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div>
                <p className="text-sm font-bold text-[#081B3A]">
                  Saved connections
                </p>
                <p className="mt-1 text-sm text-[#526173]">
                  {edges.length === 0
                    ? "No paths saved yet."
                    : `${edges.length} connection(s) saved.`}
                </p>
              </div>
            </div>
            {edges.length > 0 ? (
              <div className="mt-4 grid gap-3">
                {edges.map((edge) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3"
                    key={edge.id}
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#081B3A]">
                        {edge.sourceNode.name} -&gt; {edge.targetNode.name}
                      </p>
                      <p className="mt-1 text-xs text-[#526173]">
                        {edge.label || "Default path"}
                      </p>
                    </div>
                    <form action={deleteChatbotEdgeAction}>
                      <input name="chatbotId" type="hidden" value={chatbot.id} />
                      <input name="edgeId" type="hidden" value={edge.id} />
                      <button
                        className="inline-flex items-center rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                        type="submit"
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Remove
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel>
            <PanelTitle
              title="Add node"
              description="Create Message, Button, List, Media, Question, Condition, or Assign Agent nodes."
            />
            <div className="mt-5">
              <ChatbotNodeCreateForm chatbotId={chatbot.id} />
            </div>
          </Panel>

          <Panel>
            <PanelTitle
              title="Connect nodes"
              description="Save the path order for the future runtime engine."
            />
            <div className="mt-5">
              <ChatbotEdgeCreateForm
                chatbotId={chatbot.id}
                nodes={simpleNodes}
              />
            </div>
          </Panel>

          <Panel>
            <PanelTitle title="Nodes" description="Manage saved flow nodes." />
            <div className="mt-5 space-y-3">
              {nodes.map((node) => (
                <div
                  className="border-b border-[#BFE9D0] pb-3 last:border-b-0 last:pb-0"
                  key={node.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#081B3A]">
                        {node.name}
                      </p>
                      <span
                        className={[
                          "mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
                          nodeTone[node.type] ??
                            "bg-zinc-50 text-zinc-700 ring-zinc-200",
                        ].join(" ")}
                      >
                        {formatType(node.type)}
                      </span>
                    </div>
                    {!["START", "END"].includes(node.type) ? (
                      <form action={deleteChatbotNodeAction}>
                        <input
                          name="chatbotId"
                          type="hidden"
                          value={chatbot.id}
                        />
                        <input name="nodeId" type="hidden" value={node.id} />
                        <button
                          className="inline-flex items-center rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                          type="submit"
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Delete
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelTitle
              title="Triggers"
              description="Keyword and template triggers start published chatbot sessions."
            />

            <div className="mt-5">
              <ChatbotTriggerCreateForm chatbotId={chatbot.id} />
            </div>

            {chatbot.triggers.length === 0 ? (
              <div className="mt-5">
                <EmptyState>No triggers yet.</EmptyState>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {chatbot.triggers.map((trigger) => (
                  <div
                    className="rounded-xl border border-[#BFE9D0] p-3"
                    key={trigger.id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[#081B3A]">
                        {formatType(trigger.type)}
                      </p>
                      <StatusPill tone={trigger.isEnabled ? "green" : "zinc"}>
                        {trigger.isEnabled ? "Enabled" : "Disabled"}
                      </StatusPill>
                    </div>
                    <p className="mt-2 text-xs text-[#526173]">
                      {trigger.value ?? "No value"}
                    </p>
                    <form action={deleteChatbotTriggerAction} className="mt-3">
                      <input name="chatbotId" type="hidden" value={chatbot.id} />
                      <input name="triggerId" type="hidden" value={trigger.id} />
                      <button
                        className="inline-flex items-center rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                        type="submit"
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Delete
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel>
            <PanelTitle
              title="Fallback"
              description="Reply when a button/list answer does not match any path."
            />
            <div className="mt-5">
              <ChatbotFallbackForm
                chatbotId={chatbot.id}
                fallbackMessage={fallbackMessage}
              />
            </div>
          </Panel>

          <Panel>
            <PanelTitle
              title="Testing"
              description="Preview in browser or send a real WhatsApp test from the published bot."
            />
            <div className="mt-5 grid gap-3">
              <Link
                className={actionButtonClass("secondary")}
                href={`/dashboard/automation/chatbots/${chatbot.id}/preview`}
              >
                <Eye className="mr-2 h-4 w-4" />
                Browser preview
              </Link>
              <ChatbotWhatsAppTestForm chatbotId={chatbot.id} />
            </div>
          </Panel>

          <Panel>
            <PanelTitle
              title="Runtime logs"
              description="Session, node execution, message, and failure events are stored for debugging."
            />
            <div className="mt-5 grid gap-3">
              <div className="flex items-center gap-3 rounded-xl border border-[#BFE9D0] p-3">
                <Radio className="h-4 w-4 text-[#128C7E]" />
                <div>
                  <p className="text-sm font-semibold text-[#081B3A]">
                    Session status
                  </p>
                  <p className="text-xs text-[#526173]">
                    Active, waiting, completed, abandoned, handoff, failed
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-[#BFE9D0] p-3">
                <Cable className="h-4 w-4 text-[#128C7E]" />
                <div>
                  <p className="text-sm font-semibold text-[#081B3A]">
                    Event timeline
                  </p>
                    <p className="text-xs text-[#526173]">
                    Node, trigger, message, assignment, completion, failure
                  </p>
                </div>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelTitle
              title="Recent sessions"
              description="Latest runtime sessions created from incoming WhatsApp messages."
            />
            {chatbot.sessions.length === 0 ? (
              <div className="mt-5">
                <EmptyState>No runtime sessions yet.</EmptyState>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {chatbot.sessions.map((session) => (
                  <div
                    className="rounded-xl border border-[#BFE9D0] p-3"
                    key={session.id}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#081B3A]">
                        {session.contact
                          ? `${session.contact.name ?? "Unnamed"} (+${session.contact.countryCode}${session.contact.phoneNumber})`
                          : "Unknown contact"}
                      </p>
                      <StatusPill tone={statusTone(session.status)}>
                        {session.status}
                      </StatusPill>
                    </div>
                    <p className="mt-2 text-xs text-[#526173]">
                      Current: {session.currentNode?.name ?? "None"} -{" "}
                      {session._count.events} event(s)
                    </p>
                    <p className="mt-1 text-xs text-[#526173]">
                      Last interaction {formatDate(session.lastInteractionAt)}
                    </p>
                    <Link
                      className="mt-3 inline-flex items-center rounded-lg border border-[#BFE9D0] px-3 py-2 text-xs font-semibold text-[#128C7E] transition hover:bg-[#E7F8EF]"
                      href={`/dashboard/automation/chatbots/${chatbot.id}/sessions/${session.id}`}
                    >
                      View logs
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel>
            <PanelTitle
              title="Version"
              description={
                version
                  ? `Created ${formatDate(version.createdAt)}`
                  : "No version found"
              }
            />
            <p className="mt-4 text-sm text-[#526173]">
              {version?.status ?? "DRAFT"} - {chatbot._count.versions} total
              version(s)
            </p>
          </Panel>
        </div>
      </section>
    </div>
  );
}
