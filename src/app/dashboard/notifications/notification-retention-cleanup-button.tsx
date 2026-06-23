"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type CleanupResponse = {
  message: string;
  result?: {
    autoArchivedRecipients: number;
    deletedResolvedNotifications: number;
  };
};

export default function NotificationRetentionCleanupButton() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  async function runCleanup() {
    const confirmed = window.confirm(
      "Run notification retention cleanup now? Old read notifications may be archived and old resolved notifications may be deleted.",
    );
    if (!confirmed) return;

    setMessage("");
    setError("");
    setIsRunning(true);

    try {
      const response = await fetch(
        "/api/notifications/maintenance/retention-cleanup",
        { method: "POST" },
      );
      const data = (await response.json()) as CleanupResponse;

      if (!response.ok) {
        setError(data.message);
        return;
      }

      setMessage(
        data.result
          ? `Archived ${data.result.autoArchivedRecipients} read notification(s) and deleted ${data.result.deletedResolvedNotifications} old resolved notification(s).`
          : data.message,
      );
      router.refresh();
    } catch {
      setError("Unable to run notification cleanup.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={runCleanup}
        disabled={isRunning}
        className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRunning ? "Cleaning..." : "Run Cleanup"}
      </button>
      {message ? <p className="mt-2 text-xs text-green-700">{message}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
