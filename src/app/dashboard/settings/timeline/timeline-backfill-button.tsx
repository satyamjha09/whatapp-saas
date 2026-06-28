"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BackfillResponse = {
  ok: boolean;
  result?: {
    attributions: { createdOrUpdated: number; scanned: number; skipped: number };
    conversions: { createdOrUpdated: number; scanned: number; skipped: number };
    followUps: { createdOrUpdated: number; scanned: number; skipped: number };
  };
};

export function TimelineBackfillButton() {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runBackfill() {
    setIsRunning(true);
    setMessage(null);

    try {
      const response = await fetch("/api/settings/timeline/backfill", {
        method: "POST",
      });
      const payload = (await response.json()) as BackfillResponse & {
        message?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? "Timeline backfill failed.");
      }

      const total =
        (payload.result?.attributions.createdOrUpdated ?? 0) +
        (payload.result?.conversions.createdOrUpdated ?? 0) +
        (payload.result?.followUps.createdOrUpdated ?? 0);

      setMessage(`Backfill complete. ${total} activity rows created or refreshed.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Timeline backfill failed.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={runBackfill}
        disabled={isRunning}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {isRunning ? "Running..." : "Run timeline backfill"}
      </button>
      {message ? <p className="text-sm text-gray-600">{message}</p> : null}
    </div>
  );
}
