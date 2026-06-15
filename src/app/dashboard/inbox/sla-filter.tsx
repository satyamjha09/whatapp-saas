"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const filters = [
  {
    label: "All SLA",
    value: "",
  },
  {
    label: "Breached",
    value: "breached",
  },
  {
    label: "Overdue",
    value: "overdue",
  },
  {
    label: "Due soon",
    value: "due-soon",
  },
];

export default function SlaFilter() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function getHref(value: string) {
    const params = new URLSearchParams(searchParams.toString());

    params.delete("page");

    if (value) {
      params.set("sla", value);
    } else {
      params.delete("sla");
    }

    const query = params.toString();

    return query ? `${pathname}?${query}` : pathname;
  }

  const currentValue = searchParams.get("sla") ?? "";

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => {
        const isActive = currentValue === filter.value;

        return (
          <Link
            key={filter.value || "all"}
            href={getHref(filter.value)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              isActive
                ? "bg-white text-zinc-950"
                : "border border-white/10 bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-white"
            }`}
          >
            {filter.label}
          </Link>
        );
      })}
    </div>
  );
}
