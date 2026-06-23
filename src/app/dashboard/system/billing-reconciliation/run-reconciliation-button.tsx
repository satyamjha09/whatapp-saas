"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RunReconciliationButton() {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    if (!window.confirm("Run billing reconciliation across all companies now?")) {
      return;
    }

    setIsRunning(true);
    setError("");

    try {
      const response = await fetch("/api/system/billing-reconciliation/run", {
        method: "POST",
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(data.message ?? "Unable to run reconciliation");
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to run reconciliation");
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
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {isRunning ? "Running..." : "Run Reconciliation"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
