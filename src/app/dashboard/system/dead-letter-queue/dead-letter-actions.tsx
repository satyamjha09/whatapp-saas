"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeadLetterActions({ jobRecordId }: { jobRecordId: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function run(action: "retry" | "ignore") {
    const reason =
      action === "ignore"
        ? window.prompt("Why is this failed job being ignored?", "Reviewed in dashboard")
        : undefined;

    if (action === "ignore" && reason === null) return;
    if (
      action === "retry" &&
      !window.confirm("Retry this original BullMQ job now?")
    ) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/system/dead-letter-queue/${jobRecordId}/${action}`,
        {
          method: "POST",
          headers:
            action === "ignore" ? { "Content-Type": "application/json" } : undefined,
          body: action === "ignore" ? JSON.stringify({ reason }) : undefined,
        },
      );
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(data.message ?? `Unable to ${action} job`);
        return;
      }

      router.refresh();
    } catch {
      setError(`Unable to ${action} job`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={isLoading}
        onClick={() => run("retry")}
        className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
      >
        {isLoading ? "Working..." : "Retry"}
      </button>
      <button
        type="button"
        disabled={isLoading}
        onClick={() => run("ignore")}
        className="rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-700 disabled:opacity-60"
      >
        Ignore
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function SyncDeadLetterQueueButton() {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState("");

  async function sync() {
    setIsSyncing(true);
    setError("");

    try {
      const response = await fetch("/api/system/dead-letter-queue/sync", {
        method: "POST",
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(data.message ?? "Unable to sync failed jobs");
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to sync failed jobs");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={isSyncing}
        onClick={sync}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {isSyncing ? "Syncing..." : "Sync Failed Jobs"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
