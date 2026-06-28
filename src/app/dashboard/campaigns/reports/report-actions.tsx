"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function GenerateCampaignReportButton() {
  const router = useRouter();
  const [campaignId, setCampaignId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  async function generate() {
    if (!campaignId.trim()) return;

    setError(null);
    setIsRunning(true);

    try {
      const response = await fetch("/api/campaign-reports", {
        body: JSON.stringify({
          campaignId: campaignId.trim(),
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setError(payload?.message ?? "Unable to generate report.");
        return;
      }

      setCampaignId("");
      router.refresh();
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
          onClick={generate}
          disabled={isRunning || !campaignId.trim()}
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isRunning ? "Generating..." : "Generate Report"}
        </button>
      </div>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}

export function DownloadCampaignReportButton({
  reportId,
}: {
  reportId: string;
}) {
  return (
    <a
      href={`/api/campaign-reports/${reportId}/download`}
      className="rounded-lg border px-3 py-1.5 text-xs font-medium"
    >
      Download CSV
    </a>
  );
}
