"use client";

import {
  Handle,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  Bot,
  CircleDot,
  FileText,
  GitBranch,
  Handshake,
  MessageSquareText,
  MousePointerClick,
  Play,
  RadioTower,
} from "lucide-react";
import type {
  AutomationNodeData,
  AutomationNodeType,
} from "@/components/automation-builder/types";
import { formatNodeType } from "@/components/automation-builder/types";

export type AutomationFlowNode = Node<AutomationNodeData, "automationNode">;

const nodeTone: Record<AutomationNodeType, string> = {
  API_CALL: "border-blue-200 bg-blue-50 text-blue-700",
  CONDITION: "border-purple-200 bg-purple-50 text-purple-700",
  END: "border-rose-200 bg-rose-50 text-rose-700",
  HUMAN_HANDOFF: "border-amber-200 bg-amber-50 text-amber-700",
  QUICK_REPLY: "border-emerald-200 bg-emerald-50 text-emerald-700",
  SEND_MESSAGE: "border-[#BFE9D0] bg-[#E7F8EF] text-[#128C7E]",
  SEND_TEMPLATE: "border-cyan-200 bg-cyan-50 text-cyan-700",
  START: "border-[#BFE9D0] bg-[#E7F8EF] text-[#128C7E]",
};

function NodeIcon({ type }: { type: AutomationNodeType }) {
  if (type === "START") return <Play className="h-4 w-4" />;
  if (type === "END") return <CircleDot className="h-4 w-4" />;
  if (type === "CONDITION") return <GitBranch className="h-4 w-4" />;
  if (type === "QUICK_REPLY") {
    return <MousePointerClick className="h-4 w-4" />;
  }
  if (type === "SEND_TEMPLATE") return <FileText className="h-4 w-4" />;
  if (type === "API_CALL") return <RadioTower className="h-4 w-4" />;
  if (type === "HUMAN_HANDOFF") return <Handshake className="h-4 w-4" />;
  if (type === "SEND_MESSAGE") {
    return <MessageSquareText className="h-4 w-4" />;
  }

  return <Bot className="h-4 w-4" />;
}

function nodeSummary(data: AutomationNodeData) {
  if (data.nodeType === "START") {
    return `${String(data.triggerType ?? "KEYWORD")} trigger`;
  }

  if (data.nodeType === "SEND_MESSAGE") {
    return data.messageText || "No message text";
  }

  if (data.nodeType === "QUICK_REPLY") {
    const count = Array.isArray(data.buttons) ? data.buttons.length : 0;
    return `${data.bodyText || "No body text"} - ${count} button(s)`;
  }

  if (data.nodeType === "CONDITION") {
    return `${data.variable ?? "variable"} ${data.operator ?? "equals"} ${
      data.value ?? ""
    }`.trim();
  }

  if (data.nodeType === "SEND_TEMPLATE") {
    return data.templateId
      ? `${data.templateId} (${data.languageCode ?? "en_US"})`
      : "No template selected";
  }

  if (data.nodeType === "API_CALL") {
    return `${data.method ?? "POST"} ${data.url ?? "No URL"}`;
  }

  if (data.nodeType === "HUMAN_HANDOFF") {
    return data.messageToCustomer || "No handoff message";
  }

  return data.endReason || "Completed";
}

export default function NodeRenderer({
  data,
  selected,
}: NodeProps<AutomationFlowNode>) {
  const tone = nodeTone[data.nodeType];

  return (
    <div
      className={[
        "w-[248px] rounded-xl border bg-white shadow-[0_14px_34px_rgba(8,27,58,0.10)] transition",
        selected
          ? "border-[#128C7E] ring-4 ring-[#128C7E]/15"
          : "border-[#BFE9D0]",
      ].join(" ")}
    >
      {data.nodeType !== "START" ? (
        <Handle
          className="!h-3 !w-3 !border-2 !border-white !bg-[#128C7E]"
          position={Position.Left}
          type="target"
        />
      ) : null}

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
            {formatNodeType(data.nodeType)}
          </p>
        </div>
      </div>

      <div className="p-3">
        <p className="line-clamp-3 text-xs leading-5 text-[#526173]">
          {nodeSummary(data)}
        </p>
      </div>

      {data.nodeType !== "END" ? (
        <Handle
          className="!h-3 !w-3 !border-2 !border-white !bg-[#128C7E]"
          position={Position.Right}
          type="source"
        />
      ) : null}
    </div>
  );
}
