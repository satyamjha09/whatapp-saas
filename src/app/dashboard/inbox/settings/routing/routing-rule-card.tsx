"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type RoutingRule = {
  id: string;
  name: string;
  priority: number;
  status: string;
  conditions: unknown;
  assignmentMode: string | null;
  targetQueue: {
    id: string;
    name: string;
    status: string;
  };
  fallbackQueue: {
    id: string;
    name: string;
    status: string;
  } | null;
};

function formatConditions(conditions: unknown) {
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return "No conditions";
  }

  return conditions
    .map((condition) => {
      if (!condition || typeof condition !== "object") return "Unknown";
      const value = condition as { field?: string; operator?: string; value?: unknown };
      const renderedValue = Array.isArray(value.value)
        ? value.value.join(", ")
        : String(value.value ?? "");
      return `${value.field?.replaceAll("_", " ") ?? "Field"} ${value.operator ?? "matches"} ${renderedValue}`;
    })
    .join(" AND ");
}

export default function RoutingRuleCard({ rule }: { rule: RoutingRule }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function toggleStatus() {
    const nextStatus = rule.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    await fetch(`/api/inbox/routing-rules/${rule.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: nextStatus }),
    });
    startTransition(() => router.refresh());
  }

  async function deleteRule() {
    if (!window.confirm("Delete this routing rule?")) return;

    await fetch(`/api/inbox/routing-rules/${rule.id}`, {
      method: "DELETE",
    });
    startTransition(() => router.refresh());
  }

  return (
    <article className="rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_18px_50px_rgba(18,140,126,0.06)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black text-[#081B3A]">{rule.name}</h2>
            <span
              className={[
                "rounded-full px-2.5 py-1 text-xs font-black",
                rule.status === "ACTIVE"
                  ? "bg-[#E7F8EF] text-[#128C7E]"
                  : "bg-slate-100 text-slate-500",
              ].join(" ")}
            >
              {rule.status}
            </span>
            <span className="rounded-full bg-[#F7FFFA] px-2.5 py-1 text-xs font-black text-[#526173]">
              Priority {rule.priority}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#526173]">
            {formatConditions(rule.conditions)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-[#526173]">
            <span className="rounded-full bg-[#F7FFFA] px-2.5 py-1">
              Queue: {rule.targetQueue.name}
            </span>
            <span className="rounded-full bg-[#F7FFFA] px-2.5 py-1">
              Mode: {(rule.assignmentMode ?? "Queue default").replaceAll("_", " ")}
            </span>
            {rule.fallbackQueue ? (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                Fallback: {rule.fallbackQueue.name}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-xl border border-[#BFE9D0] px-3 py-2 text-xs font-black text-[#128C7E] transition hover:bg-[#E7F8EF]"
            disabled={isPending}
            onClick={toggleStatus}
            type="button"
          >
            {rule.status === "ACTIVE" ? "Disable" : "Enable"}
          </button>
          <button
            className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-50"
            disabled={isPending}
            onClick={deleteRule}
            type="button"
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}
