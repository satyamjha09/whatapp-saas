"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RotateCcw, Send } from "lucide-react";
import { actionButtonClass } from "@/app/dashboard/dashboard-ui";

type PreviewNode = {
  config: unknown;
  id: string;
  name: string;
  nodeKey: string;
  type: string;
};

type PreviewEdge = {
  id: string;
  label: string | null;
  sourceNodeId: string;
  targetNodeId: string;
};

type PreviewMessage = {
  id: string;
  nodeId?: string | null;
  options?: string[];
  role: "bot" | "user";
  text: string;
};

type PreviewLog = {
  detail?: string;
  event: string;
  id: string;
  nodeLabel?: string;
  status: "ok" | "failed" | "waiting";
};

type WaitingState = {
  choices: string[];
  nodeId: string;
  type: "choice" | "question";
};

function id(prefix: string) {
  return `${prefix}_${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizedText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function buttonValues(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").slice(0, 3)
    : [];
}

function listRows(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.flatMap((section) => {
    const record = asRecord(section);
    const rows = Array.isArray(record.rows) ? record.rows : [];

    return rows
      .map((row) => asRecord(row))
      .map((row) => textValue(row.title))
      .filter(Boolean);
  });
}

function fieldValue(context: Record<string, string>, field: string) {
  if (field === "last_reply") return context.last_reply ?? "";
  return context[field] ?? "";
}

function renderPreviewTemplate(value: unknown, context: Record<string, string>) {
  const template = textValue(value);

  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key) =>
    fieldValue(context, String(key)),
  );
}

function evaluateCondition(
  config: Record<string, unknown>,
  context: Record<string, string>,
) {
  const field = textValue(config.field, "last_reply");
  const operator = textValue(config.operator, "equals");
  const expected = normalizedText(textValue(config.value));
  const actual = normalizedText(fieldValue(context, field));

  if (operator === "contains") return actual.includes(expected);
  if (operator === "exists") return Boolean(actual);
  if (operator === "not_equals") return actual !== expected;
  return actual === expected;
}

function pickConditionEdge(edges: PreviewEdge[], result: boolean) {
  const positive = ["true", "yes", "match", "matched", "success"];
  const negative = ["false", "no", "else", "default", "fallback"];
  const wanted = result ? positive : negative;

  return (
    edges.find((edge) => wanted.includes(normalizedText(edge.label))) ??
    (result ? edges[0] : edges[1] ?? edges[0])
  );
}

function pickReplyEdge(edges: PreviewEdge[], replyText: string) {
  const reply = normalizedText(replyText);

  return (
    edges.find((edge) => {
      const label = normalizedText(edge.label);
      return label && (label === reply || label.includes(reply) || reply.includes(label));
    }) ?? edges[0]
  );
}

function pickChoiceEdge(edges: PreviewEdge[], replyText: string, choices: string[]) {
  const reply = normalizedText(replyText);

  return (
    edges.find((edge) => normalizedText(edge.label) === reply) ??
    edges.find((edge) => {
      const label = normalizedText(edge.label);
      return choices.some((choice) => normalizedText(choice) === reply) &&
        choices.some((choice) => normalizedText(choice) === label);
    }) ??
    null
  );
}

export default function ChatbotPreviewClient({
  chatbotName,
  edges,
  fallbackMessage,
  nodes,
}: {
  chatbotName: string;
  edges: PreviewEdge[];
  fallbackMessage: string;
  nodes: PreviewNode[];
}) {
  const [context, setContext] = useState<Record<string, string>>({});
  const [input, setInput] = useState("");
  const [logs, setLogs] = useState<PreviewLog[]>([]);
  const [messages, setMessages] = useState<PreviewMessage[]>([]);
  const [waiting, setWaiting] = useState<WaitingState | null>(null);

  const nodeById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );
  const startNode = useMemo(
    () => nodes.find((node) => node.type === "START") ?? null,
    [nodes],
  );

  const addLog = useCallback((log: Omit<PreviewLog, "id">) => {
    setLogs((current) => [...current, { ...log, id: id("log") }]);
  }, []);

  const addBotMessage = useCallback(
    (message: Omit<PreviewMessage, "id" | "role">) => {
      setMessages((current) => [
        ...current,
        { ...message, id: id("bot"), role: "bot" },
      ]);
    },
    [],
  );

  const outgoingEdges = useCallback(
    (nodeId: string) =>
      edges.filter((edge) => edge.sourceNodeId === nodeId),
    [edges],
  );

  const runFrom = useCallback(
    (nodeId: string | null, nextContext: Record<string, string>) => {
      let currentNodeId = nodeId;

      for (let step = 0; step < 20; step += 1) {
        if (!currentNodeId) {
          addLog({
            detail: "No next node selected",
            event: "Session completed",
            status: "ok",
          });
          setWaiting(null);
          return;
        }

        const node = nodeById.get(currentNodeId);

        if (!node) {
          addLog({
            detail: currentNodeId,
            event: "Node missing",
            status: "failed",
          });
          setWaiting(null);
          return;
        }

        const config = asRecord(node.config);
        const outgoing = outgoingEdges(node.id);

        addLog({
          event: "Node entered",
          nodeLabel: node.name,
          status: "ok",
        });

        if (node.type === "END") {
          addLog({
            event: "Session completed",
            nodeLabel: node.name,
            status: "ok",
          });
          setWaiting(null);
          return;
        }

        if (node.type === "START") {
          currentNodeId = outgoing[0]?.targetNodeId ?? null;
          addLog({
            detail: currentNodeId ?? "None",
            event: "Start completed",
            nodeLabel: node.name,
            status: "ok",
          });
          continue;
        }

        if (node.type === "MESSAGE") {
          addBotMessage({
            nodeId: node.id,
            text: textValue(config.body, node.name),
          });
          currentNodeId = outgoing[0]?.targetNodeId ?? null;
          addLog({
            detail: currentNodeId ?? "None",
            event: "Message sent",
            nodeLabel: node.name,
            status: "ok",
          });
          continue;
        }

        if (node.type === "QUICK_REPLY") {
          const choices = buttonValues(config.buttons);
          addBotMessage({
            nodeId: node.id,
            options: choices,
            text: textValue(config.body, node.name),
          });
          setWaiting({ choices, nodeId: node.id, type: "choice" });
          addLog({
            detail: choices.join(", "),
            event: "Waiting for button reply",
            nodeLabel: node.name,
            status: "waiting",
          });
          return;
        }

        if (node.type === "LIST_MENU") {
          const choices = listRows(config.sections);
          addBotMessage({
            nodeId: node.id,
            options: choices,
            text: `${textValue(config.body, node.name)}\n${textValue(
              config.primaryButton,
              "View options",
            )}`,
          });
          setWaiting({ choices, nodeId: node.id, type: "choice" });
          addLog({
            detail: `${choices.length} row(s)`,
            event: "Waiting for list reply",
            nodeLabel: node.name,
            status: "waiting",
          });
          return;
        }

        if (node.type === "MEDIA_BUTTONS") {
          const choices = buttonValues(config.buttons);
          const mediaType = textValue(config.headerMediaType, "MEDIA");
          addBotMessage({
            nodeId: node.id,
            options: choices,
            text: `[${mediaType}] ${textValue(config.body, node.name)}`,
          });
          setWaiting({ choices, nodeId: node.id, type: "choice" });
          addLog({
            detail: choices.join(", "),
            event: "Waiting for media button reply",
            nodeLabel: node.name,
            status: "waiting",
          });
          return;
        }

        if (node.type === "QUESTION") {
          addBotMessage({
            nodeId: node.id,
            text: textValue(config.body, node.name),
          });
          setWaiting({ choices: [], nodeId: node.id, type: "question" });
          addLog({
            detail: textValue(config.saveAs, "answer"),
            event: "Waiting for question answer",
            nodeLabel: node.name,
            status: "waiting",
          });
          return;
        }

        if (node.type === "CONDITION") {
          const result = evaluateCondition(config, nextContext);
          const edge = pickConditionEdge(outgoing, result);
          currentNodeId = edge?.targetNodeId ?? null;
          addLog({
            detail: result ? "true" : "false",
            event: "Condition evaluated",
            nodeLabel: node.name,
            status: "ok",
          });
          continue;
        }

        if (
          [
            "API_CALL",
            "WEBHOOK",
            "GOOGLE_SHEET_SAVE",
            "TALLY_INVOICE_LOOKUP",
            "TALLY_LEDGER_BALANCE",
          ].includes(node.type)
        ) {
          const responseField = textValue(config.responseField, "business_result");
          const successMessage = renderPreviewTemplate(
            config.successMessage,
            nextContext,
          );

          nextContext[responseField] = "simulated_success";

          if (successMessage) {
            addBotMessage({
              nodeId: node.id,
              text: successMessage,
            });
          }

          currentNodeId = outgoing[0]?.targetNodeId ?? null;
          addLog({
            detail: textValue(config.url, textValue(config.endpointUrl, "Simulated")),
            event: `${node.type.replaceAll("_", " ")} simulated`,
            nodeLabel: node.name,
            status: "ok",
          });
          continue;
        }

        if (node.type === "CATALOG_PRODUCT_CARD") {
          const title = textValue(config.productTitle, "Product");
          const description = textValue(config.productDescription);
          const productUrl = textValue(config.productUrl);

          addBotMessage({
            nodeId: node.id,
            text: [
              `[Product] ${title}`,
              description,
              productUrl ? `Open: ${productUrl}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
          });
          currentNodeId = outgoing[0]?.targetNodeId ?? null;
          addLog({
            detail: title,
            event: "Catalog product card sent",
            nodeLabel: node.name,
            status: "ok",
          });
          continue;
        }

        if (node.type === "PAYMENT_LINK") {
          const paymentUrl = textValue(config.paymentLinkUrl);

          addBotMessage({
            nodeId: node.id,
            text: [
              textValue(config.body, "Please complete payment."),
              textValue(config.amount) ? `Amount: ${textValue(config.amount)}` : "",
              paymentUrl ? `Pay: ${paymentUrl}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
          });
          currentNodeId = outgoing[0]?.targetNodeId ?? null;
          addLog({
            detail: paymentUrl || "Payment link",
            event: "Payment link sent",
            nodeLabel: node.name,
            status: "ok",
          });
          continue;
        }

        if (node.type === "AI_REPLY") {
          const reply =
            renderPreviewTemplate(config.fallback, nextContext) ||
            `Thanks. I noted: ${nextContext.last_reply || "your request"}.`;
          const responseField = textValue(config.responseField, "ai_reply");

          nextContext[responseField] = reply;
          addBotMessage({
            nodeId: node.id,
            text: reply,
          });
          currentNodeId = outgoing[0]?.targetNodeId ?? null;
          addLog({
            detail: responseField,
            event: "AI reply simulated",
            nodeLabel: node.name,
            status: "ok",
          });
          continue;
        }

        if (node.type === "ASSIGN_AGENT") {
          addBotMessage({
            nodeId: node.id,
            text: textValue(config.note, "Our team will contact you shortly."),
          });
          addLog({
            detail: textValue(config.assignTo, "agent"),
            event: "Assigned agent",
            nodeLabel: node.name,
            status: "ok",
          });
          setWaiting(null);
          return;
        }

        addLog({
          event: `Unsupported node: ${node.type}`,
          nodeLabel: node.name,
          status: "failed",
        });
        setWaiting(null);
        return;
      }

      addLog({
        event: "Runtime safety stop",
        status: "failed",
      });
      setWaiting(null);
    },
    [addBotMessage, addLog, nodeById, outgoingEdges],
  );

  const resetPreview = useCallback(() => {
    setContext({});
    setInput("");
    setLogs([]);
    setMessages([]);
    setWaiting(null);
    runFrom(startNode?.id ?? null, {});
  }, [runFrom, startNode?.id]);

  useEffect(() => {
    const timer = window.setTimeout(resetPreview, 0);

    return () => window.clearTimeout(timer);
  }, [resetPreview]);

  const sendReply = useCallback(
    (reply: string) => {
      const text = reply.trim();
      if (!text || !waiting) return;

      const waitingNode = nodeById.get(waiting.nodeId);
      if (!waitingNode) return;

      const config = asRecord(waitingNode.config);
      const outgoing = outgoingEdges(waitingNode.id);
      const nextContext: Record<string, string> = {
        ...context,
        last_reply: text,
      };

      if (waiting.type === "question") {
        nextContext[textValue(config.saveAs, "answer")] = text;
      }

      setMessages((current) => [
        ...current,
        { id: id("user"), role: "user", text },
      ]);
      setInput("");

      const edge =
        waiting.type === "choice"
          ? pickChoiceEdge(outgoing, text, waiting.choices)
          : pickReplyEdge(outgoing, text);

      if (waiting.type === "choice" && outgoing.length > 0 && !edge) {
        addBotMessage({
          nodeId: waitingNode.id,
          text: textValue(config.fallbackMessage) || fallbackMessage,
        });
        addLog({
          detail: text,
          event: "Fallback sent",
          nodeLabel: waitingNode.name,
          status: "failed",
        });
        setContext(nextContext);
        return;
      }

      addLog({
        detail: edge?.targetNodeId ?? "None",
        event: "Reply received",
        nodeLabel: waitingNode.name,
        status: "ok",
      });
      setContext(nextContext);
      setWaiting(null);
      runFrom(edge?.targetNodeId ?? null, nextContext);
    },
    [
      addBotMessage,
      addLog,
      context,
      fallbackMessage,
      nodeById,
      outgoingEdges,
      runFrom,
      waiting,
    ],
  );

  const failedLogs = logs.filter((log) => log.status === "failed");

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_16px_40px_rgba(8,27,58,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#081B3A]">{chatbotName}</h2>
            <p className="mt-1 text-sm text-[#526173]">Browser preview</p>
          </div>
          <button
            className={actionButtonClass("secondary")}
            onClick={resetPreview}
            type="button"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </button>
        </div>

        <div className="mt-5 min-h-[520px] rounded-2xl bg-[#E7F8EF] p-4">
          <div className="mx-auto flex min-h-[490px] max-w-lg flex-col rounded-[28px] border border-[#BFE9D0] bg-white p-4 shadow-[0_18px_44px_rgba(8,27,58,0.12)]">
            <div className="border-b border-[#BFE9D0] pb-3">
              <p className="font-bold text-[#081B3A]">{chatbotName}</p>
              <p className="text-xs text-[#526173]">
                {waiting ? "Waiting for reply" : "Flow complete"}
              </p>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto py-4">
              {messages.map((message) => (
                <div
                  className={[
                    "max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-6",
                    message.role === "bot"
                      ? "mr-auto bg-[#F7FBFF] text-[#081B3A]"
                      : "ml-auto bg-[#DCF8C6] text-[#081B3A]",
                  ].join(" ")}
                  key={message.id}
                >
                  <p className="whitespace-pre-wrap">{message.text}</p>
                  {message.options?.length ? (
                    <div className="mt-3 grid gap-2">
                      {message.options.map((option) => (
                        <button
                          className="rounded-xl border border-[#BFE9D0] bg-white px-3 py-2 text-left text-xs font-semibold text-[#128C7E] transition hover:bg-[#E7F8EF]"
                          key={option}
                          onClick={() => sendReply(option)}
                          type="button"
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <form
              className="flex gap-2 border-t border-[#BFE9D0] pt-3"
              onSubmit={(event) => {
                event.preventDefault();
                sendReply(input);
              }}
            >
              <input
                className="min-w-0 flex-1 rounded-xl border border-[#BFE9D0] px-3 py-2 text-sm outline-none focus:border-[#128C7E]/40"
                disabled={!waiting}
                onChange={(event) => setInput(event.target.value)}
                placeholder={waiting ? "Type reply" : "Preview complete"}
                value={input}
              />
              <button
                className="grid h-10 w-10 place-items-center rounded-xl bg-[#128C7E] text-white disabled:opacity-50"
                disabled={!waiting || !input.trim()}
                type="submit"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </section>

      <aside className="space-y-5">
        <section className="rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_16px_40px_rgba(8,27,58,0.08)]">
          <h2 className="text-lg font-bold text-[#081B3A]">
            Node execution history
          </h2>
          <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto">
            {logs.map((log) => (
              <div
                className="rounded-xl border border-[#BFE9D0] p-3"
                key={log.id}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#081B3A]">
                    {log.event}
                  </p>
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      log.status === "failed"
                        ? "bg-rose-100 text-rose-700"
                        : log.status === "waiting"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-[#E7F8EF] text-[#128C7E]",
                    ].join(" ")}
                  >
                    {log.status}
                  </span>
                </div>
                {log.nodeLabel ? (
                  <p className="mt-2 text-xs text-[#526173]">{log.nodeLabel}</p>
                ) : null}
                {log.detail ? (
                  <p className="mt-1 break-words text-xs text-[#526173]">
                    {log.detail}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_16px_40px_rgba(8,27,58,0.08)]">
          <h2 className="text-lg font-bold text-[#081B3A]">Failed node logs</h2>
          <div className="mt-4 space-y-3">
            {failedLogs.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#BFE9D0] bg-[#E7F8EF] p-3 text-sm text-[#526173]">
                No failed preview steps.
              </p>
            ) : (
              failedLogs.map((log) => (
                <div
                  className="rounded-xl border border-rose-200 bg-rose-50 p-3"
                  key={log.id}
                >
                  <p className="text-sm font-semibold text-rose-700">
                    {log.event}
                  </p>
                  <p className="mt-1 text-xs text-rose-700">
                    {log.nodeLabel ?? "Unknown node"}
                  </p>
                  {log.detail ? (
                    <p className="mt-1 break-words text-xs text-rose-700">
                      {log.detail}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}
