"use client";

import type { ImportValidationSummary } from "./types";

export function ContactImportSummary({
  summary,
}: {
  summary: ImportValidationSummary;
}) {
  const items = [
    {
      label: "Total rows",
      value: summary.totalRows,
      className: "text-[#081B3A]",
    },
    {
      label: "Valid",
      value: summary.validRows,
      className: "text-[#15803d]",
    },
    {
      label: "Duplicates",
      value: summary.duplicateRows,
      className: "text-amber-600",
    },
    {
      label: "Invalid",
      value: summary.invalidRows,
      className: "text-rose-600",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-[#BFE9D0] bg-white p-4"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-[#526173]">
            {item.label}
          </p>
          <p className={`mt-1 text-2xl font-bold ${item.className}`}>
            {item.value.toLocaleString("en-IN")}
          </p>
        </div>
      ))}
    </div>
  );
}
