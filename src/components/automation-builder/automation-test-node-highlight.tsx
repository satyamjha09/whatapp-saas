"use client";

const statuses = [
  { className: "bg-[#128C7E]", label: "Success" },
  { className: "bg-amber-400", label: "Waiting" },
  { className: "bg-rose-500", label: "Failed" },
  { className: "bg-slate-400", label: "Skipped" },
];

export default function AutomationTestNodeHighlight() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {statuses.map((status) => (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-[#D6EADF] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#526173]"
          key={status.label}
        >
          <span className={`h-2 w-2 rounded-full ${status.className}`} />
          {status.label}
        </span>
      ))}
    </div>
  );
}
