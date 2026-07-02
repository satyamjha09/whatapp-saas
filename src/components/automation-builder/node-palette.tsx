"use client";

import {
  CircleDot,
  FileText,
  GitBranch,
  Handshake,
  MessageSquareText,
  MousePointerClick,
  Play,
  Plus,
  RadioTower,
} from "lucide-react";
import {
  automationNodeTypes,
  formatNodeType,
  type AutomationNodeType,
} from "@/components/automation-builder/types";

type NodePaletteProps = {
  onAddNode: (type: AutomationNodeType) => void;
};

const nodeMeta: Record<
  AutomationNodeType,
  {
    description: string;
    icon: typeof Play;
  }
> = {
  API_CALL: {
    description: "Call an external endpoint",
    icon: RadioTower,
  },
  CONDITION: {
    description: "Route by variable value",
    icon: GitBranch,
  },
  END: {
    description: "Finish the journey",
    icon: CircleDot,
  },
  HUMAN_HANDOFF: {
    description: "Move chat to team inbox",
    icon: Handshake,
  },
  QUICK_REPLY: {
    description: "Send reply buttons",
    icon: MousePointerClick,
  },
  SEND_MESSAGE: {
    description: "Send text or media",
    icon: MessageSquareText,
  },
  SEND_TEMPLATE: {
    description: "Send approved template",
    icon: FileText,
  },
  START: {
    description: "Choose trigger",
    icon: Play,
  },
};

export default function NodePalette({ onAddNode }: NodePaletteProps) {
  return (
    <div className="rounded-2xl border border-[#BFE9D0] bg-white p-3 shadow-[0_14px_34px_rgba(8,27,58,0.08)]">
      <div className="mb-3 px-1">
        <p className="text-sm font-bold text-[#081B3A]">Nodes</p>
        <p className="mt-1 text-xs leading-5 text-[#526173]">
          Add blocks to the automation canvas.
        </p>
      </div>

      <div className="grid gap-2">
        {automationNodeTypes.map((type) => {
          const Icon = nodeMeta[type].icon;

          return (
            <button
              className="group flex w-full items-center gap-3 rounded-xl border border-[#BFE9D0] bg-white p-3 text-left transition hover:border-[#128C7E]/40 hover:bg-[#E7F8EF]"
              key={type}
              onClick={() => onAddNode(type)}
              type="button"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#E7F8EF] text-[#128C7E]">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[#081B3A]">
                  {formatNodeType(type)}
                </span>
                <span className="mt-1 block text-xs text-[#526173]">
                  {nodeMeta[type].description}
                </span>
              </span>
              <Plus className="h-4 w-4 text-[#128C7E] opacity-70 transition group-hover:opacity-100" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
