"use client";

import { useState, useTransition } from "react";
import { Bot, Loader2, Sparkles } from "lucide-react";
import InboxAiReplySuggestions from "@/app/dashboard/inbox/inbox-ai-reply-suggestions";
import InboxAiSummary from "@/app/dashboard/inbox/inbox-ai-summary";

type InboxAiPanelProps = {
  contactId: string;
  initialSummary: {
    result: string;
    status: string;
    staleAt: string | null;
    errorMessage: string | null;
    provider: string;
    model: string;
    latencyMs: number | null;
    createdAt: string;
  } | null;
  initialSuggestions: Array<{
    id: string;
    tone: string;
    result: string;
    status: string;
    errorMessage: string | null;
    createdAt: string;
  }>;
};

const TONES = [
  "Professional",
  "Friendly",
  "Concise",
  "Apologetic",
  "Sales-focused",
  "Support-focused",
];

export default function InboxAiPanel({
  contactId,
  initialSummary,
  initialSuggestions,
}: InboxAiPanelProps) {
  const [summary, setSummary] = useState(initialSummary);
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [selectedTone, setSelectedTone] = useState("Professional");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function generateSummary() {
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/inbox/${contactId}/ai/summary`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Unable to generate summary");
        return;
      }

      setSummary({
        ...data.summary,
        createdAt: data.summary.createdAt,
        staleAt: data.summary.staleAt,
      });
    });
  }

  function generateSuggestion() {
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/inbox/${contactId}/ai/suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone: selectedTone }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Unable to generate suggestion");
        return;
      }

      setSuggestions((current) => [data.suggestion, ...current].slice(0, 6));
    });
  }

  return (
    <section className="mt-4 rounded-2xl border border-[#BFE9D0] bg-[#F5FCF8] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#128C7E]">
            <Bot className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-[#102040]">AI copilot</h3>
            <p className="mt-1 text-xs leading-5 text-[#526173]">
              Human-reviewed summaries, reply drafts, and translations. AI never sends messages automatically.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={generateSummary}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-[#128C7E] px-3 py-2 text-xs font-semibold text-white hover:bg-[#075E54] disabled:opacity-60"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Generate summary
        </button>
      </div>

      {error ? (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="mt-4">
        <InboxAiSummary summary={summary} />
      </div>

      <div className="mt-4 border-t border-[#BFE9D0] pt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-sm font-bold text-[#102040]">Reply suggestions</h4>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedTone}
              onChange={(event) => setSelectedTone(event.target.value)}
              className="rounded-xl border border-[#BFE9D0] bg-white px-3 py-2 text-xs font-semibold text-[#102040] outline-none focus:ring-4 focus:ring-[#128C7E]/10"
            >
              {TONES.map((tone) => (
                <option key={tone} value={tone}>
                  {tone}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={generateSuggestion}
              disabled={isPending}
              className="rounded-xl border border-[#128C7E]/30 bg-white px-3 py-2 text-xs font-semibold text-[#128C7E] hover:bg-[#E7F8EF] disabled:opacity-60"
            >
              Generate draft
            </button>
          </div>
        </div>

        <InboxAiReplySuggestions suggestions={suggestions} />
      </div>
    </section>
  );
}
