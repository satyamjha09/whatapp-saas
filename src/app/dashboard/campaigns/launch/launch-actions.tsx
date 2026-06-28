"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ConfirmLaunchButton({
  launchRunId,
  disabled,
}: {
  launchRunId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setIsRunning(true);
    setError("");

    try {
      const response = await fetch(`/api/campaign-launch/${launchRunId}/confirm`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to queue launch.");
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to queue launch.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={confirm}
        disabled={disabled || isRunning}
        className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
      >
        {isRunning ? "Queueing..." : "Confirm & Queue"}
      </button>
      {error ? <p className="max-w-48 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
