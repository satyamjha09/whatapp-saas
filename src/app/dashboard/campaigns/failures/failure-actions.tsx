"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AnalyzeCampaignFailuresButton() {
  const router = useRouter();
  const [campaignId, setCampaignId] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");

  async function analyze() {
    if (!campaignId.trim()) return;

    setIsRunning(true);
    setError("");

    try {
      const response = await fetch("/api/campaign-failures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to analyze campaign failures.");
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to analyze campaign failures.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <input
          value={campaignId}
          onChange={(event) => setCampaignId(event.target.value)}
          placeholder="Campaign ID"
          className="rounded-xl border px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={analyze}
          disabled={isRunning || !campaignId.trim()}
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isRunning ? "Analyzing..." : "Analyze"}
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export function FailureInsightActions({
  insightId,
  retrySafety,
  status,
}: {
  insightId: string;
  retrySafety: string;
  status: string;
}) {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");

  async function retry() {
    setIsRunning(true);
    setError("");

    try {
      const response = await fetch(
        `/api/campaign-failures/insights/${insightId}/retry`,
        { method: "POST" },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to retry failure group.");
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to retry failure group.");
    } finally {
      setIsRunning(false);
    }
  }

  async function updateStatus(nextStatus: "FIXED" | "IGNORED") {
    const ignoreReason =
      nextStatus === "IGNORED"
        ? window.prompt("Reason for ignoring this insight:")
        : null;

    if (nextStatus === "IGNORED" && !ignoreReason) return;

    setIsRunning(true);
    setError("");

    try {
      const response = await fetch(
        `/api/campaign-failures/insights/${insightId}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus, ignoreReason }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to update failure insight.");
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to update failure insight.");
    } finally {
      setIsRunning(false);
    }
  }

  const closed = status !== "OPEN";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={retry}
          disabled={isRunning || closed || retrySafety !== "SAFE_TO_RETRY"}
          className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          Safe Retry
        </button>
        <button
          type="button"
          onClick={() => updateStatus("FIXED")}
          disabled={isRunning || closed}
          className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          Mark Fixed
        </button>
        <button
          type="button"
          onClick={() => updateStatus("IGNORED")}
          disabled={isRunning || closed}
          className="rounded-lg border px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-50"
        >
          Ignore
        </button>
      </div>
      {error ? <p className="max-w-80 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
