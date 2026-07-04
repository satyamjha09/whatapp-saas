"use client";

import {
  CircleDot,
  Clock3,
  Contact,
  CreditCard,
  Database,
  FileText,
  GitBranch,
  Handshake,
  Hourglass,
  List,
  Lock,
  MessageSquareText,
  MousePointerClick,
  Play,
  Plus,
  RadioTower,
  ReceiptText,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Tags,
  Table2,
} from "lucide-react";
import {
  automationNodeTypes,
  getAutomationNodeDescription,
  getAutomationNodeLabel,
  type AutomationNodeType,
} from "@/components/automation-builder/types";
import {
  advancedAutomationNodeTypes,
  isAutomationNodeTypeEnabled,
} from "@/lib/automation-builder/feature-flags";
import NodeUpgradeBadge from "@/components/automation-builder/node-upgrade-badge";

type NodePaletteProps = {
  onAddNode: (type: AutomationNodeType) => void;
  allowedNodes?: string[];
  disabled?: boolean;
  onLockedNodeClick?: (type: string) => void;
  variant?: "default" | "compact";
};

const nodeMeta: Record<
  AutomationNodeType,
  {
    icon: typeof Play;
  }
> = {
  ADD_TAG: {
    icon: Tags,
  },
  AI_REPLY: {
    icon: Sparkles,
  },
  API_CALL: {
    icon: RadioTower,
  },
  BUTTON_REPLY_ROUTER: {
    icon: GitBranch,
  },
  CATALOG_SEND: {
    icon: ReceiptText,
  },
  CONDITION: {
    icon: GitBranch,
  },
  DELAY: {
    icon: Clock3,
  },
  END: {
    icon: CircleDot,
  },
  ERROR_HANDLER: {
    icon: ShieldAlert,
  },
  FALLBACK: {
    icon: ShieldAlert,
  },
  GOOGLE_SHEET_APPEND_ROW: {
    icon: Table2,
  },
  GOOGLE_SHEET_UPDATE_ROW: {
    icon: Table2,
  },
  HUMAN_HANDOFF: {
    icon: Handshake,
  },
  LIST_MESSAGE: {
    icon: List,
  },
  PAYMENT_LINK: {
    icon: CreditCard,
  },
  QUICK_REPLY: {
    icon: MousePointerClick,
  },
  REMOVE_TAG: {
    icon: Tags,
  },
  RETRY: {
    icon: RotateCcw,
  },
  SEND_MESSAGE: {
    icon: MessageSquareText,
  },
  SEND_TEMPLATE: {
    icon: FileText,
  },
  START: {
    icon: Play,
  },
  TALLY_LOOKUP: {
    icon: Database,
  },
  TEMPLATE_TRIGGER: {
    icon: RadioTower,
  },
  UPDATE_CONTACT_FIELD: {
    icon: Contact,
  },
  WAIT_FOR_REPLY: {
    icon: Hourglass,
  },
  WEBHOOK: {
    icon: RadioTower,
  },
};

const requiredPlanMap: Record<string, "PRO" | "BUSINESS" | "ENTERPRISE"> = {
  WEBHOOK: "PRO",
  GOOGLE_SHEET_APPEND_ROW: "PRO",
  GOOGLE_SHEET_UPDATE_ROW: "PRO",
  PAYMENT_LINK: "PRO",
  LIST_MESSAGE: "PRO",
  API_CALL: "PRO",
  FALLBACK: "PRO",
  ERROR_HANDLER: "PRO",
  TALLY_LOOKUP: "BUSINESS",
  CATALOG_SEND: "BUSINESS",
  AI_REPLY: "BUSINESS",
  RETRY: "BUSINESS",
};

const advancedTypes = new Set<AutomationNodeType>(advancedAutomationNodeTypes);
const coreNodeTypes = automationNodeTypes.filter((type) => !advancedTypes.has(type));

function NodeButton({
  onAddNode,
  type,
  allowedNodes,
  disabled = false,
  onLockedNodeClick,
  variant = "default",
}: {
  onAddNode: (type: AutomationNodeType) => void;
  type: AutomationNodeType;
  allowedNodes?: string[];
  disabled?: boolean;
  onLockedNodeClick?: (type: string) => void;
  variant?: "default" | "compact";
}) {
  const Icon = nodeMeta[type].icon;
  const flagEnabled = isAutomationNodeTypeEnabled(type);
  const isPlanAllowed = allowedNodes ? allowedNodes.includes(type) : true;
  const enabled = flagEnabled && isPlanAllowed && !disabled;
  const reqPlan = requiredPlanMap[type];
  const isCompact = variant === "compact";

  const handleClick = () => {
    if (!isPlanAllowed && onLockedNodeClick) {
      onLockedNodeClick(type);
      return;
    }
    if (enabled) {
      onAddNode(type);
    }
  };

  return (
    <button
      className={[
        "group flex w-full items-center rounded-xl border text-left transition",
        isCompact ? "gap-2 px-2.5 py-2" : "gap-3 p-3",
        enabled
          ? "border-[#BFE9D0] bg-white hover:border-[#128C7E]/40 hover:bg-[#E7F8EF]"
          : "border-slate-200 bg-slate-50/80 hover:bg-slate-100/80",
      ].join(" ")}
      disabled={disabled}
      key={type}
      onClick={handleClick}
      title={disabled ? "Read-only mode" : undefined}
      type="button"
    >
      <span
        className={[
          "grid shrink-0 place-items-center rounded-lg",
          isCompact ? "h-8 w-8" : "h-9 w-9",
          enabled ? "bg-[#E7F8EF] text-[#128C7E]" : "bg-white text-slate-400 border border-slate-200",
        ].join(" ")}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-1">
          <span className="truncate text-sm font-semibold text-[#081B3A]">
            {getAutomationNodeLabel(type)}
          </span>
          {reqPlan && !isPlanAllowed && <NodeUpgradeBadge requiredPlan={reqPlan} />}
        </span>
        <span className={isCompact ? "sr-only" : "mt-1 block text-xs text-[#526173]"}>
          {getAutomationNodeDescription(type)}
        </span>
      </span>
      {enabled ? (
        <Plus className="h-4 w-4 text-[#128C7E] opacity-70 transition group-hover:opacity-100" />
      ) : (
        <Lock className="h-4 w-4 text-slate-400" />
      )}
    </button>
  );
}

export default function NodePalette({
  onAddNode,
  allowedNodes,
  disabled = false,
  onLockedNodeClick,
  variant = "default",
}: NodePaletteProps) {
  const isCompact = variant === "compact";

  return (
    <div
      className={[
        "rounded-2xl border border-[#BFE9D0] bg-white shadow-[0_14px_34px_rgba(8,27,58,0.08)]",
        isCompact ? "flex h-full min-h-0 flex-col p-2.5" : "p-3",
      ].join(" ")}
    >
      <div className={isCompact ? "mb-2 px-1" : "mb-3 px-1"}>
        <p
          className={
            isCompact
              ? "text-xs font-bold uppercase text-[#081B3A]"
              : "text-sm font-bold text-[#081B3A]"
          }
        >
          Nodes
        </p>
        <p
          className={
            isCompact
              ? "mt-0.5 text-[11px] leading-4 text-[#526173]"
              : "mt-1 text-xs leading-5 text-[#526173]"
          }
        >
          Add blocks to the automation canvas.
        </p>
      </div>

      <div className={isCompact ? "min-h-0 flex-1 overflow-y-auto pr-1" : ""}>
        <div className={isCompact ? "grid gap-1.5" : "grid gap-2"}>
          {coreNodeTypes.map((type) => (
            <NodeButton
              key={type}
              onAddNode={onAddNode}
              type={type}
              allowedNodes={allowedNodes}
              disabled={disabled}
              onLockedNodeClick={onLockedNodeClick}
              variant={variant}
            />
          ))}
        </div>

        <div
          className={
            isCompact
              ? "mt-3 border-t border-[#E7F8EF] pt-3"
              : "mt-5 border-t border-[#E7F8EF] pt-4"
          }
        >
          <p className="px-1 text-xs font-bold uppercase tracking-normal text-[#128C7E]">
            Advanced
          </p>
          <div className={isCompact ? "mt-2 grid gap-1.5" : "mt-3 grid gap-2"}>
            {advancedAutomationNodeTypes.map((type) => (
              <NodeButton
                key={type}
                onAddNode={onAddNode}
                type={type}
                allowedNodes={allowedNodes}
                disabled={disabled}
                onLockedNodeClick={onLockedNodeClick}
                variant={variant}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
