"use client";

import { Lock } from "lucide-react";

type NodeUpgradeBadgeProps = {
  requiredPlan: "PRO" | "BUSINESS" | "ENTERPRISE" | string;
};

export default function NodeUpgradeBadge({ requiredPlan }: NodeUpgradeBadgeProps) {
  const planColors: Record<string, string> = {
    PRO: "bg-blue-50 text-blue-700 border-blue-200",
    BUSINESS: "bg-purple-50 text-purple-700 border-purple-200",
    ENTERPRISE: "bg-amber-50 text-amber-800 border-amber-200",
  };

  const colorStyle = planColors[requiredPlan.toUpperCase()] || "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${colorStyle}`}>
      <Lock className="h-2.5 w-2.5" />
      <span>{requiredPlan.toUpperCase()}</span>
    </span>
  );
}
