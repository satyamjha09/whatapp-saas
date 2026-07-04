"use client";

import {
  Handle,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  Check,
  Bot,
  CircleDot,
  Clock3,
  Contact,
  CreditCard,
  Database,
  FileText,
  GitBranch,
  Handshake,
  Hourglass,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  List,
  MessageSquareText,
  MousePointerClick,
  Play,
  Plus,
  ReceiptText,
  RadioTower,
  Tags,
  Table2,
} from "lucide-react";
import {
  getNodeInputHandles,
  getNodeOutputHandles,
} from "@/lib/automation-builder/connection-handles";
import type {
  AutomationFlowNodeData,
  AutomationNodeData,
  AutomationNodeType,
} from "@/components/automation-builder/types";
import {
  getAutomationNodeIcon,
  getAutomationNodeLabel,
} from "@/components/automation-builder/types";

export type AutomationFlowNode = Node<AutomationFlowNodeData, "automationNode">;

type NodeRendererProps = NodeProps<AutomationFlowNode> & {
  connectedSourceHandles?: Set<string>;
  onAddFromHandle?: (input: {
    sourceHandle: string;
    sourceNodeId: string;
  }) => void;
};

const nodeTone: Record<AutomationNodeType, string> = {
  ADD_TAG: "border-lime-200 bg-lime-50 text-lime-700",
  AI_REPLY: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
  API_CALL: "border-blue-200 bg-blue-50 text-blue-700",
  BUTTON_REPLY_ROUTER: "border-violet-200 bg-violet-50 text-violet-700",
  CATALOG_SEND: "border-teal-200 bg-teal-50 text-teal-700",
  CONDITION: "border-purple-200 bg-purple-50 text-purple-700",
  DELAY: "border-slate-200 bg-slate-50 text-slate-700",
  END: "border-rose-200 bg-rose-50 text-rose-700",
  ERROR_HANDLER: "border-red-200 bg-red-50 text-red-700",
  FALLBACK: "border-amber-200 bg-amber-50 text-amber-700",
  GOOGLE_SHEET_APPEND_ROW: "border-emerald-200 bg-emerald-50 text-emerald-700",
  GOOGLE_SHEET_UPDATE_ROW: "border-emerald-200 bg-emerald-50 text-emerald-700",
  HUMAN_HANDOFF: "border-amber-200 bg-amber-50 text-amber-700",
  LIST_MESSAGE: "border-cyan-200 bg-cyan-50 text-cyan-700",
  PAYMENT_LINK: "border-green-200 bg-green-50 text-green-700",
  QUICK_REPLY: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REMOVE_TAG: "border-lime-200 bg-lime-50 text-lime-700",
  RETRY: "border-orange-200 bg-orange-50 text-orange-700",
  SEND_MESSAGE: "border-[#BFE9D0] bg-[#E7F8EF] text-[#128C7E]",
  SEND_TEMPLATE: "border-cyan-200 bg-cyan-50 text-cyan-700",
  START: "border-[#BFE9D0] bg-[#E7F8EF] text-[#128C7E]",
  TALLY_LOOKUP: "border-sky-200 bg-sky-50 text-sky-700",
  TEMPLATE_TRIGGER: "border-[#BFE9D0] bg-[#E7F8EF] text-[#128C7E]",
  UPDATE_CONTACT_FIELD: "border-orange-200 bg-orange-50 text-orange-700",
  WAIT_FOR_REPLY: "border-indigo-200 bg-indigo-50 text-indigo-700",
  WEBHOOK: "border-blue-200 bg-blue-50 text-blue-700",
};

function NodeIcon({ type }: { type: AutomationNodeType }) {
  const icon = getAutomationNodeIcon(type);
  if (icon === "play") return <Play className="h-4 w-4" />;
  if (icon === "trigger") return <RadioTower className="h-4 w-4" />;
  if (icon === "end") return <CircleDot className="h-4 w-4" />;
  if (icon === "branch") return <GitBranch className="h-4 w-4" />;
  if (icon === "router") return <GitBranch className="h-4 w-4" />;
  if (icon === "buttons") return <MousePointerClick className="h-4 w-4" />;
  if (icon === "list") return <List className="h-4 w-4" />;
  if (icon === "template") return <FileText className="h-4 w-4" />;
  if (icon === "wait") return <Hourglass className="h-4 w-4" />;
  if (icon === "api") return <RadioTower className="h-4 w-4" />;
  if (icon === "webhook") return <RadioTower className="h-4 w-4" />;
  if (icon === "handoff") return <Handshake className="h-4 w-4" />;
  if (icon === "tag") return <Tags className="h-4 w-4" />;
  if (icon === "contact") return <Contact className="h-4 w-4" />;
  if (icon === "delay") return <Clock3 className="h-4 w-4" />;
  if (icon === "message") return <MessageSquareText className="h-4 w-4" />;
  if (icon === "sheet") return <Table2 className="h-4 w-4" />;
  if (icon === "tally") return <Database className="h-4 w-4" />;
  if (icon === "payment") return <CreditCard className="h-4 w-4" />;
  if (icon === "catalog") return <ReceiptText className="h-4 w-4" />;
  if (icon === "ai") return <Sparkles className="h-4 w-4" />;
  if (icon === "fallback") return <ShieldAlert className="h-4 w-4" />;
  if (icon === "retry") return <RotateCcw className="h-4 w-4" />;
  if (icon === "error") return <ShieldAlert className="h-4 w-4" />;

  return <Bot className="h-4 w-4" />;
}

function nodeSummary(data: AutomationFlowNodeData): string {
  if (data.nodeType === "START") {
    return `${String(data.triggerType ?? "KEYWORD")} trigger`;
  }

  if (data.nodeType === "TEMPLATE_TRIGGER") {
    return `${String(data.triggerName ?? "Template reply received")} - ${String(
      data.triggerMode ?? "ANY_TEMPLATE_REPLY",
    )}`;
  }

  if (data.nodeType === "SEND_MESSAGE") {
    return String(data.messageText || "No message text");
  }

  if (data.nodeType === "QUICK_REPLY") {
    const count = Array.isArray(data.buttons) ? data.buttons.length : 0;
    return `${data.bodyText || "No body text"} - ${count} button(s)`;
  }

  if (data.nodeType === "LIST_MESSAGE") {
    const sectionCount = Array.isArray(data.sections) ? data.sections.length : 0;
    return `${data.bodyText || "No body text"} - ${sectionCount} section(s)`;
  }

  if (data.nodeType === "CONDITION") {
    return `${data.variable ?? "variable"} ${data.operator ?? "equals"} ${
      data.value ?? ""
    }`.trim();
  }

  if (data.nodeType === "SEND_TEMPLATE") {
    const templateName = data.templateName || data.templateId;
    return templateName
      ? `${templateName} (${data.languageCode ?? "en_US"})`
      : "No template selected";
  }

  if (data.nodeType === "WAIT_FOR_REPLY") {
    return `Wait ${String(data.timeoutMinutes ?? 0)} min, save as ${
      data.saveReplyAs ?? "reply"
    }`;
  }

  if (data.nodeType === "BUTTON_REPLY_ROUTER") {
    const routes = Array.isArray(data.routes) ? data.routes.length : 0;
    return `${routes} button route(s)${
      data.fallbackEnabled === false ? "" : " + fallback"
    }`;
  }

  if (data.nodeType === "API_CALL") {
    return `${data.method ?? "POST"} ${data.url ?? "No URL"}`;
  }

  if (data.nodeType === "WEBHOOK") {
    return `${data.method ?? "POST"} ${data.url ?? "No URL"} - ${data.retryCount ?? 0} retries`;
  }

  if (data.nodeType === "GOOGLE_SHEET_APPEND_ROW") {
    const count = Array.isArray(data.columnMappings)
      ? data.columnMappings.length
      : 0;
    return `${data.sheetName ?? "Sheet1"} - append ${count} column(s)`;
  }

  if (data.nodeType === "GOOGLE_SHEET_UPDATE_ROW") {
    return `${data.sheetName ?? "Sheet1"} - lookup ${data.lookupColumn ?? "column"}`;
  }

  if (data.nodeType === "TALLY_LOOKUP") {
    return `${data.lookupType ?? "LEDGER_BALANCE"} -> ${data.saveResultAs ?? "tallyResult"}`;
  }

  if (data.nodeType === "PAYMENT_LINK") {
    return `${data.provider ?? "CASHFREE"} ${data.currency ?? "INR"} - ${data.purpose ?? "Payment"}`;
  }

  if (data.nodeType === "CATALOG_SEND") {
    const products = Array.isArray(data.productIds) ? data.productIds.length : 0;
    return `${data.catalogSource ?? "MANUAL_PRODUCTS"} - ${products} product(s)`;
  }

  if (data.nodeType === "AI_REPLY") {
    return `Save reply as ${data.saveReplyAs ?? "aiReply"} - threshold ${data.confidenceThreshold ?? 0.7}`;
  }

  if (data.nodeType === "FALLBACK") {
    return `${data.nextAction ?? "SEND_MESSAGE"} - ${data.fallbackMessage ?? "No message"}`;
  }

  if (data.nodeType === "RETRY") {
    return `${data.maxRetries ?? 3} retries, ${data.retryDelaySeconds ?? 5}s delay`;
  }

  if (data.nodeType === "ERROR_HANDLER") {
    return `Open inbox: ${data.openInbox ? "yes" : "no"}, end: ${data.endSession ? "yes" : "no"}`;
  }

  if (data.nodeType === "HUMAN_HANDOFF") {
    return String(data.messageToCustomer || "No handoff message");
  }

  if (data.nodeType === "ADD_TAG" || data.nodeType === "REMOVE_TAG") {
    return data.tagName ? `Tag: ${String(data.tagName)}` : "No tag selected";
  }

  if (data.nodeType === "UPDATE_CONTACT_FIELD") {
    return `${data.fieldName ?? "field"} = ${data.fieldValue ?? ""}`;
  }

  if (data.nodeType === "DELAY") {
    return `${String(data.duration ?? 0)} ${String(data.unit ?? "MINUTES").toLowerCase()}`;
  }

  return String(data.endReason || "Completed");
}

function handleTop(index: number, total: number) {
  if (total <= 1) return "50%";
  return `${Math.round(((index + 1) / (total + 1)) * 100)}%`;
}

function toAutomationNode(id: string, data: AutomationFlowNodeData) {
  const {
    nodeType,
    testIsCurrent,
    testStatus,
    validationIssueCount,
    validationSeverity,
    ...nodeData
  } = data;

  void testIsCurrent;
  void testStatus;
  void validationIssueCount;
  void validationSeverity;

  return {
    data: nodeData as AutomationNodeData,
    id,
    position: { x: 0, y: 0 },
    type: nodeType,
  };
}

export default function NodeRenderer({
  connectedSourceHandles,
  data,
  id,
  onAddFromHandle,
  selected,
}: NodeRendererProps) {
  const tone = nodeTone[data.nodeType];
  const graphNode = toAutomationNode(id, data);
  const inputHandles = getNodeInputHandles(graphNode);
  const outputHandles = getNodeOutputHandles(graphNode);
  const statusClass =
    data.testStatus === "FAILED"
      ? "border-rose-500 ring-4 ring-rose-100"
      : data.testStatus === "WAITING" || data.testIsCurrent
        ? "border-amber-400 ring-4 ring-amber-100"
        : data.testStatus === "SUCCESS"
          ? "border-[#128C7E] ring-4 ring-[#128C7E]/10"
          : data.testStatus === "SKIPPED"
            ? "border-slate-300 ring-4 ring-slate-100"
            : selected
              ? "border-[#128C7E] ring-4 ring-[#128C7E]/15"
              : "border-[#BFE9D0]";
  const statusLabel =
    data.testStatus === "FAILED"
      ? "Failed"
      : data.testStatus === "WAITING"
        ? "Waiting"
        : data.testStatus === "SUCCESS"
          ? "Passed"
          : data.testStatus === "SKIPPED"
            ? "Skipped"
            : data.testStatus === "RUNNING"
              ? "Running"
              : null;

  return (
    <div
      className={[
        "w-[248px] rounded-xl border bg-white shadow-[0_14px_34px_rgba(8,27,58,0.10)] transition",
        statusClass,
      ].join(" ")}
    >
      {inputHandles.map((handle, index) => (
        <Handle
          className="!h-3 !w-3 !border-2 !border-white !bg-[#128C7E]"
          id={handle.id}
          key={handle.id}
          position={Position.Left}
          style={{ top: handleTop(index, inputHandles.length) }}
          title={handle.label}
          type="target"
        />
      ))}

      <div className="flex items-start gap-3 border-b border-[#E7F8EF] p-3">
        <span
          className={[
            "grid h-9 w-9 shrink-0 place-items-center rounded-lg border",
            tone,
          ].join(" ")}
        >
          <NodeIcon type={data.nodeType} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[#081B3A]">
            {data.label}
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-normal text-[#128C7E]">
            {getAutomationNodeLabel(data.nodeType)}
          </p>
        </div>
        {data.validationSeverity ? (
          <span
            className={[
              "ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
              data.validationSeverity === "ERROR"
                ? "bg-rose-100 text-rose-700"
                : "bg-amber-100 text-amber-700",
            ].join(" ")}
            title={`${data.validationIssueCount ?? 1} validation issue(s)`}
          >
            {data.validationIssueCount ?? 1}
          </span>
        ) : null}
      </div>

      {statusLabel ? (
        <div className="border-b border-[#E7F8EF] px-3 py-2">
          <span
            className={[
              "inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-normal",
              data.testStatus === "FAILED"
                ? "bg-rose-100 text-rose-700"
                : data.testStatus === "WAITING" || data.testIsCurrent
                  ? "bg-amber-100 text-amber-700"
                  : data.testStatus === "SKIPPED"
                    ? "bg-slate-100 text-slate-600"
                    : "bg-[#E7F8EF] text-[#128C7E]",
            ].join(" ")}
          >
            Test {statusLabel}
          </span>
        </div>
      ) : null}

      <div className="p-3">
        <p className="line-clamp-3 text-xs leading-5 text-[#526173]">
          {nodeSummary(data)}
        </p>
      </div>

      {outputHandles.length > 0 ? (
        <div className="grid gap-1 border-t border-[#E7F8EF] px-3 py-2">
          {outputHandles.map((handle) => (
            <div
              className="flex items-center justify-between gap-2 text-[11px] font-semibold text-[#526173]"
              key={`label-${handle.id}`}
            >
              <span className="truncate">{handle.label}</span>
              {onAddFromHandle ? (
                <button
                  className={[
                    "nodrag nopan grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs transition",
                    connectedSourceHandles?.has(handle.id)
                      ? "cursor-not-allowed border-[#BFE9D0] bg-[#E7F8EF] text-[#128C7E]"
                      : "border-[#128C7E]/25 bg-white text-[#128C7E] hover:border-[#128C7E] hover:bg-[#E7F8EF]",
                  ].join(" ")}
                  disabled={connectedSourceHandles?.has(handle.id)}
                  onClick={(event) => {
                    event.stopPropagation();
                    onAddFromHandle({
                      sourceHandle: handle.id,
                      sourceNodeId: id,
                    });
                  }}
                  onMouseDown={(event) => event.stopPropagation()}
                  title={
                    connectedSourceHandles?.has(handle.id)
                      ? `${handle.label} path is already connected`
                      : `Add node on ${handle.label} path`
                  }
                  type="button"
                >
                  {connectedSourceHandles?.has(handle.id) ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#128C7E]" />
              )}
            </div>
          ))}
        </div>
      ) : null}

      {outputHandles.map((handle, index) => (
        <Handle
          className="!h-3 !w-3 !border-2 !border-white !bg-[#128C7E]"
          id={handle.id}
          key={handle.id}
          position={Position.Right}
          style={{ top: handleTop(index, outputHandles.length) }}
          title={handle.label}
          type="source"
        />
      ))}
    </div>
  );
}
