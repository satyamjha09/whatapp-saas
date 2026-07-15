"use client";

import { CopyPlus } from "lucide-react";

type InboxAiReplySuggestionsProps = {
  suggestions: Array<{
    id: string;
    tone: string;
    result: string;
    status: string;
    errorMessage: string | null;
    createdAt: string;
  }>;
};

function insertSuggestion(text: string) {
  window.dispatchEvent(
    new CustomEvent("metawhat:insert-inbox-reply", {
      detail: { text },
    }),
  );
}

export default function InboxAiReplySuggestions({
  suggestions,
}: InboxAiReplySuggestionsProps) {
  const visibleSuggestions = suggestions.filter(
    (suggestion) => suggestion.status === "COMPLETED" && suggestion.result,
  );

  if (visibleSuggestions.length === 0) {
    const latestFailure = suggestions.find(
      (suggestion) => suggestion.status === "FAILED",
    );

    return (
      <p className="rounded-xl border border-dashed border-[#BFE9D0] bg-white p-3 text-sm text-[#526173]">
        {latestFailure?.errorMessage ||
          "No reply suggestions yet. Generate one, review it, then insert it into the composer."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {visibleSuggestions.map((suggestion) => (
        <div
          key={suggestion.id}
          className="rounded-xl border border-[#BFE9D0] bg-white p-3"
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="rounded-full bg-[#E7F8EF] px-2 py-1 text-xs font-semibold text-[#128C7E]">
              {suggestion.tone}
            </span>
            <button
              type="button"
              onClick={() => insertSuggestion(suggestion.result)}
              className="inline-flex items-center gap-1 rounded-lg border border-[#BFE9D0] px-2 py-1 text-xs font-semibold text-[#128C7E] hover:bg-[#E7F8EF]"
            >
              <CopyPlus className="h-3.5 w-3.5" />
              Insert
            </button>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-6 text-[#102040]">
            {suggestion.result}
          </p>
        </div>
      ))}
    </div>
  );
}
