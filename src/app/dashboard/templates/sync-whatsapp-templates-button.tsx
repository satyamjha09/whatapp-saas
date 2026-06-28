"use client";

import { CheckCircle2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { actionButtonClass } from "@/app/dashboard/dashboard-ui";

type SyncResponse = {
  message?: string;
  result?: {
    fetchedCount: number;
    syncedCount: number;
    skippedCount: number;
  };
};

export default function SyncWhatsAppTemplatesButton({
  canManage,
}: {
  canManage: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  async function syncTemplates() {
    setError("");
    setSuccess("");
    setIsSyncing(true);

    try {
      const response = await fetch("/api/whatsapp/templates/sync", {
        method: "POST",
      });
      const data = (await response.json()) as SyncResponse;

      if (!response.ok) {
        setError(data.message ?? "Unable to sync templates.");
        return;
      }

      const syncedCount = data.result?.syncedCount ?? 0;
      const skippedCount = data.result?.skippedCount ?? 0;
      setSuccess(
        `${syncedCount} template(s) synced${
          skippedCount ? `; ${skippedCount} unsupported template(s) skipped` : ""
        }.`,
      );
      router.refresh();
    } catch {
      setError("Unable to sync templates.");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={syncTemplates}
        disabled={!canManage || isSyncing}
        className={actionButtonClass("secondary")}
      >
        <RefreshCw
          className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`}
        />
        {isSyncing ? "Syncing..." : "Sync Template"}
      </button>

      {error ? (
        <p
          role="alert"
          className="mt-3 max-w-md rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
        >
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="mt-3 flex max-w-md items-center gap-2 rounded-xl border border-[#22C55E]/25 bg-[#22C55E]/10 p-3 text-sm text-[#15803d]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </p>
      ) : null}
    </div>
  );
}
