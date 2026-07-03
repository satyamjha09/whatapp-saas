"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";

type UpgradeRequiredBannerProps = {
  title?: string;
  message: string;
  requiredPlan?: string;
};

export default function UpgradeRequiredBanner({
  title = "Plan Limit Warning",
  message,
  requiredPlan,
}: UpgradeRequiredBannerProps) {
  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-950 p-4 rounded-xl flex items-center justify-between gap-4 shadow-xs">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-bold text-amber-900">{title}</h4>
          <p className="text-xs text-amber-800 leading-relaxed mt-0.5">{message}</p>
        </div>
      </div>

      <Link
        href="/dashboard/billing/upgrade"
        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition shadow-2xs"
      >
        <span>{requiredPlan ? `Upgrade to ${requiredPlan}` : "Upgrade Plan"}</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
