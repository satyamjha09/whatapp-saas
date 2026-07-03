"use client";

import Link from "next/link";
import { Lock, Sparkles, ArrowRight } from "lucide-react";
import NodeUpgradeBadge from "./node-upgrade-badge";

type LockedNodeModalProps = {
  isOpen: boolean;
  nodeType: string | null;
  nodeLabel: string;
  requiredPlan: string;
  onClose: () => void;
};

export default function LockedNodeModal({
  isOpen,
  nodeType,
  nodeLabel,
  requiredPlan,
  onClose,
}: LockedNodeModalProps) {
  if (!isOpen || !nodeType) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#081B3A]/45 p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-[#D8E6F3]">
        <div className="flex items-start justify-between pb-3 border-b border-[#F1F5F9]">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#081B3A]">{nodeLabel}</h3>
                <NodeUpgradeBadge requiredPlan={requiredPlan} />
              </div>
              <p className="text-xs text-[#526173]">Locked Feature Node</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#526173] hover:text-[#081B3A] text-xl font-bold"
          >
            &times;
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <p className="text-xs text-[#526173] leading-relaxed">
            The <strong>{nodeLabel}</strong> node requires the <strong>{requiredPlan}</strong> subscription plan or higher. Upgrade your workspace plan to unlock this advanced node and build more powerful automated workflows.
          </p>

          <div className="bg-[#F8FAFC] border border-[#D8E6F3] p-4 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#081B3A]">
              <Sparkles className="h-4 w-4 text-[#0052CC]" />
              <span>What you get with {requiredPlan}:</span>
            </div>
            <ul className="text-xs text-slate-600 space-y-1 pl-6 list-disc">
              <li>Access to {nodeLabel} and other advanced integration nodes</li>
              <li>Higher monthly execution & test quotas</li>
              <li>Advanced analytics & drop-off insights</li>
            </ul>
          </div>

          <div className="flex gap-3 pt-2 border-t border-[#F1F5F9]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-xs font-semibold border border-[#D8E6F3] rounded-xl hover:bg-slate-50 text-slate-700"
            >
              Close
            </button>
            <Link
              href="/dashboard/billing/upgrade"
              className="flex-1 py-2.5 text-xs font-bold bg-[#0052CC] text-white rounded-xl hover:bg-[#0040A3] flex items-center justify-center gap-2 shadow-xs transition"
            >
              <span>Upgrade Plan</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
