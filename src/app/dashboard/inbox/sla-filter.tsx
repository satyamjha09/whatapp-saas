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
    <div className="flex flex-wrap gap-1.5">
      {filters.map((filter) => {
        const isActive = currentValue === filter.value;

        return (
          <Link
            key={filter.value || "all"}
            href={getHref(filter.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              isActive
                ? "border-[#128C7E]/25 bg-[#E7F8EF] text-[#128C7E]"
                : "border border-[#BFE9D0] bg-white text-[#526173] hover:bg-[#E7F8EF] hover:text-[#081B3A]"
            }`}
          >
            {filter.label}
          </Link>
        );
      })}
    </div>
  );
}
