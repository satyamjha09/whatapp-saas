"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type MaintenanceResponse = {
  message: string;
  recovery?: {
    recoveredCount: number;
  };
  cleanup?: {
    deleted: {
      sent: number;
      skipped: number;
      failed: number;
    };
  };
};

export default function EmailMaintenanceButton() {
  const router = useRouter();

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  async function runMaintenance() {
    const confirmed = window.confirm(
      "Run notification email maintenance now? This may recover stale pending emails and delete old resolved email delivery rows.",
    );

    if (!confirmed) return;

    setMessage("");
    setError("");
    setIsRunning(true);

    try {
      const response = await fetch(
        "/api/notifications/email-deliveries/maintenance",
        {
          method: "POST",
        },
      );

      const data = (await response.json()) as MaintenanceResponse;

      if (!response.ok) {
        setError(data.message);
        return;
      }

      const deleted = data.cleanup?.deleted;

      setMessage(
        deleted
          ? `Recovered ${
              data.recovery?.recoveredCount ?? 0
            } stale email(s). Deleted ${deleted.sent} sent, ${
              deleted.skipped
            } skipped, and ${deleted.failed} failed delivery row(s).`
          : data.message,
      );

      router.refresh();
    } catch {
      setError("Unable to run email maintenance.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={runMaintenance}
        disabled={isRunning}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRunning ? "Running..." : "Run Maintenance"}
      </button>

      {message ? <p className="mt-2 text-xs text-green-700">{message}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
