"use client";

import { useState, useTransition } from "react";
import { Languages, Loader2, PenLine } from "lucide-react";

type InboxMessageTranslationProps = {
  messageId: string;
  defaultTargetLanguage?: string;
};

function insertReply(text: string) {
  window.dispatchEvent(
    new CustomEvent("metawhat:insert-inbox-reply", {
      detail: { text },
    }),
  );
}

export default function InboxMessageTranslation({
  messageId,
  defaultTargetLanguage = "English",
}: InboxMessageTranslationProps) {
  const [targetLanguage, setTargetLanguage] = useState(defaultTargetLanguage);
  const [translatedText, setTranslatedText] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function translateMessage() {
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/messages/${messageId}/translation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Unable to translate message");
        return;
      }

      if (data.translation?.status === "FAILED") {
        setError(data.translation.errorMessage || "Translation failed");
        return;
      }

      setTranslatedText(data.translation.translatedText);
    });
  }

  return (
    <div className="mt-3 rounded-xl border border-[#BFE9D0] bg-[#F5FCF8] p-3 text-[#102040]">
      <div className="flex flex-wrap items-center gap-2">
        <Languages className="h-4 w-4 text-[#128C7E]" />
        <input
          value={targetLanguage}
          onChange={(event) => setTargetLanguage(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-[#BFE9D0] bg-white px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-[#128C7E]/10"
          placeholder="Target language"
        />
        <button
          type="button"
          onClick={translateMessage}
          disabled={isPending || !targetLanguage.trim()}
          className="inline-flex items-center gap-1 rounded-lg bg-[#128C7E] px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : null}
          Translate
        </button>
      </div>

      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}

      {translatedText ? (
        <div className="mt-3 space-y-2">
          <p className="whitespace-pre-wrap text-xs leading-5 text-[#102040]">
            {translatedText}
          </p>
          <button
            type="button"
            onClick={() => insertReply(translatedText)}
            className="inline-flex items-center gap-1 rounded-lg border border-[#BFE9D0] bg-white px-2 py-1 text-xs font-semibold text-[#128C7E] hover:bg-[#E7F8EF]"
          >
            <PenLine className="h-3.5 w-3.5" />
            Insert as reply
          </button>
        </div>
      ) : null}
    </div>
  );
}
