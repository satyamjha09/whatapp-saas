"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function GenerateBillingSnapshotButton() {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);

  async function run() {
    setIsRunning(true);

    try {
      await fetch("/api/billing/analytics/snapshot", {
        method: "POST",
      });

      router.refresh();
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={isRunning}
      className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm transition hover:bg-gray-50 disabled:opacity-60"
    >
      {isRunning ? "Generating..." : "Generate Snapshot"}
    </button>
  );
}
