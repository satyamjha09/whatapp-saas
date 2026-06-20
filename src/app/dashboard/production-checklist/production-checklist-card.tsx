import { ArrowRight, CheckCircle2, Clock3, TriangleAlert } from "lucide-react";
import Link from "next/link";
import {
  getChecklistStatusClasses,
  getChecklistStatusLabel,
  type ProductionChecklistItem,
} from "@/lib/production-checklist";

export default function ProductionChecklistCard({
  item,
}: {
  item: ProductionChecklistItem;
}) {
  const StatusIcon =
    item.status === "complete"
      ? CheckCircle2
      : item.status === "warning"
        ? TriangleAlert
        : Clock3;

  return (
    <article className="flex min-h-44 flex-col rounded-2xl border border-[#D8E6F3] bg-white p-4 shadow-[0_12px_30px_rgba(8,27,58,0.06)]">
      <div className="flex items-start gap-3">
        <div
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ${getChecklistStatusClasses(item.status)}`}
        >
          <StatusIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-sm font-bold text-[#081B3A]">{item.title}</h3>
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${getChecklistStatusClasses(item.status)}`}
            >
              {getChecklistStatusLabel(item.status)}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#526173]">
            {item.description}
          </p>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <span className="text-[11px] font-medium text-[#526173]">
          {item.required ? "Required" : "Recommended"}
        </span>
        <Link
          href={item.actionHref}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0052CC] transition hover:text-[#003F9E]"
        >
          {item.actionLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}
