"use client";

import { AlertTriangle, CheckCircle2, Clock3, Loader2, MinusCircle } from "lucide-react";
import type { AutomationTestStep } from "@/components/automation-builder/automation-test-types";

const statusTone: Record<AutomationTestStep["status"], string> = {
  FAILED: "border-rose-200 bg-rose-50 text-rose-700",
  RUNNING: "border-blue-200 bg-blue-50 text-blue-700",
  SKIPPED: "border-slate-200 bg-slate-50 text-slate-700",
  SUCCESS: "border-[#BFE9D0] bg-[#E7F8EF] text-[#128C7E]",
  WAITING: "border-amber-200 bg-amber-50 text-amber-700",
};

function StatusIcon({ status }: { status: AutomationTestStep["status"] }) {
  if (status === "SUCCESS") return <CheckCircle2 className="h-4 w-4" />;
  if (status === "FAILED") return <AlertTriangle className="h-4 w-4" />;
  if (status === "WAITING") return <Clock3 className="h-4 w-4" />;
  if (status === "RUNNING") return <Loader2 className="h-4 w-4 animate-spin" />;
  return <MinusCircle className="h-4 w-4" />;
}

function summarize(value: unknown) {
  if (!value) return "";

  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  if (typeof record.body === "string") return record.body;
  if (typeof record.bodyText === "string") return record.bodyText;
  if (typeof record.preview === "string") return record.preview;
  if (typeof record.message === "string") return record.message;
  if (typeof record.error === "string") return record.error;

  return JSON.stringify(value).slice(0, 160);
}

export default function AutomationTestStepList({
  onSelectNode,
  steps,
}: {
  onSelectNode: (nodeId: string) => void;
  steps: AutomationTestStep[];
}) {
  if (steps.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#BFE9D0] bg-white p-4 text-sm text-[#526173]">
        No dry-run steps yet.
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {steps.map((step, index) => (
        <button
          className="w-full rounded-xl border border-[#D6EADF] bg-white p-3 text-left transition hover:border-[#128C7E]"
          key={step.id}
          onClick={() => onSelectNode(step.nodeId)}
          type="button"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#081B3A]">
                {index + 1}. {step.nodeType}
              </p>
              <p className="mt-1 truncate text-xs text-[#526173]">
                {step.nodeId}
              </p>
            </div>
            <span
              className={[
                "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold",
                statusTone[step.status],
              ].join(" ")}
            >
              <StatusIcon status={step.status} />
              {step.status}
            </span>
          </div>
          {summarize(step.output) ? (
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#526173]">
              {summarize(step.output)}
            </p>
          ) : null}
          {step.errorMessage ? (
            <p className="mt-2 rounded-lg bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">
              {step.errorMessage}
            </p>
          ) : null}
          {step.durationMs !== null ? (
            <p className="mt-2 text-[11px] font-semibold text-[#7B8794]">
              {step.durationMs}ms
            </p>
          ) : null}
        </button>
      ))}
    </div>
  );
}
