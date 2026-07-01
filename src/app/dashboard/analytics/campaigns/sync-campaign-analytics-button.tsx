"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SyncCampaignAnalyticsButton({
  campaignId,
}: {
  campaignId: string;
}) {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState("");

  async function sync() {
    setIsSyncing(true);
    setError("");

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/analytics/sync`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to sync analytics");
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to sync analytics");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={sync}
        disabled={isSyncing}
        className="inline-flex items-center rounded-lg border border-[#BFE9D0] px-3 py-1.5 text-xs font-semibold text-[#081B3A] transition hover:bg-[#E7F8EF] disabled:opacity-60"
      >
        <RefreshCw
          className={`mr-2 h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`}
        />
        {isSyncing ? "Syncing" : "Sync"}
      </button>

      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
