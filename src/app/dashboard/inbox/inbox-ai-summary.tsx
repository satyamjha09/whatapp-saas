"use client";

type InboxAiSummaryProps = {
  summary: {
    result: string;
    status: string;
    staleAt: string | null;
    errorMessage: string | null;
    provider: string;
    model: string;
    latencyMs: number | null;
    createdAt: string;
  } | null;
};

export default function InboxAiSummary({ summary }: InboxAiSummaryProps) {
  if (!summary) {
    return (
      <p className="rounded-xl border border-dashed border-[#BFE9D0] bg-white p-3 text-sm text-[#526173]">
        No AI summary yet. Generate one to brief the agent before replying.
      </p>
    );
  }

  if (summary.status === "FAILED") {
    return (
      <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
        {summary.errorMessage || "AI summary failed."}
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-[#BFE9D0] bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[#526173]">
        <span className="rounded-full bg-[#E7F8EF] px-2 py-1 font-semibold text-[#128C7E]">
          {summary.staleAt ? "Stale summary" : "Fresh summary"}
        </span>
        <span>
          {summary.provider} / {summary.model}
        </span>
        {summary.latencyMs ? <span>{summary.latencyMs}ms</span> : null}
      </div>

      <p className="whitespace-pre-wrap text-sm leading-6 text-[#102040]">
        {summary.result}
      </p>
    </div>
  );
}
