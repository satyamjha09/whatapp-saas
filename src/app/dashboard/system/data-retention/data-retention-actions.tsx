"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RunDataRetentionButton({ dryRun }: { dryRun: boolean }) {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setIsRunning(true);
    setError("");

    try {
      const response = await fetch("/api/system/data-retention/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dryRun }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to run retention");
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to run retention");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={run}
        disabled={isRunning}
        className={
          dryRun
            ? "rounded-xl border px-4 py-2 text-sm font-medium disabled:opacity-60"
            : "rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        }
      >
        {isRunning
          ? "Running..."
          : dryRun
            ? "Run Dry-Run Preview"
            : "Run Real Cleanup"}
      </button>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export function ReleaseLegalHoldButton({
  legalHoldId,
}: {
  legalHoldId: string;
}) {
  const router = useRouter();
  const [isReleasing, setIsReleasing] = useState(false);

  async function release() {
    setIsReleasing(true);

    try {
      await fetch(`/api/system/legal-holds/${legalHoldId}/release`, {
        method: "POST",
      });

      router.refresh();
    } finally {
      setIsReleasing(false);
    }
  }

  return (
    <button
      type="button"
      onClick={release}
      disabled={isReleasing}
      className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-60"
    >
      {isReleasing ? "Releasing..." : "Release"}
    </button>
  );
}
