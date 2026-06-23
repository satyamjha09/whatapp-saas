"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type CleanupResponse = {
  message: string;
  result?: {
    deleted: {
      apiRequestLogs: number;
      webhookDeliveryLogs: number;
      deliveredOutboxEvents: number;
      failedOutboxEvents: number;
    };
  };
};

export default function RetentionCleanupButton() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  async function runCleanup() {
    const confirmed = window.confirm(
      "Run developer data retention cleanup now? Old API logs, webhook deliveries, and terminal outbox events may be deleted.",
    );
    if (!confirmed) return;

    setMessage("");
    setError("");
    setIsRunning(true);

    try {
      const response = await fetch(
        "/api/developer/maintenance/retention-cleanup",
        { method: "POST" },
      );
      const data = (await response.json()) as CleanupResponse;

      if (!response.ok) {
        setError(data.message);
        return;
      }

      const deleted = data.result?.deleted;
      setMessage(
        deleted
          ? `Deleted ${deleted.apiRequestLogs} API logs, ${deleted.webhookDeliveryLogs} deliveries, ${deleted.deliveredOutboxEvents} delivered events, and ${deleted.failedOutboxEvents} failed events.`
          : data.message,
      );
      router.refresh();
    } catch {
      setError("Unable to run cleanup.");
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
        className="rounded-lg border border-[#D8E6F3] px-4 py-2 text-sm font-semibold text-[#0052CC] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRunning ? "Cleaning..." : "Run Retention Cleanup"}
      </button>
      {message && <p className="mt-2 text-xs text-green-700">{message}</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
