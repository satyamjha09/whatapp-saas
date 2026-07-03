import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";

type PlanLimitWarningProps = {
  title?: string;
  message: string;
  actionHref?: string;
  actionLabel?: string;
};

export default function PlanLimitWarning({
  actionHref = "/dashboard/billing/upgrade",
  actionLabel = "Upgrade plan",
  message,
  title = "Plan limit reached",
}: PlanLimitWarningProps) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <p className="text-sm font-bold">{title}</p>
            <p className="mt-1 text-sm leading-6 text-amber-800">{message}</p>
          </div>
        </div>
        <Link
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
          href={actionHref}
        >
          {actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
