"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReconcilePlanCheckoutsButton() {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);

  async function run() {
    setIsRunning(true);

    try {
      await fetch("/api/billing/plan-checkouts/reconcile", {
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
      className="rounded-xl border px-4 py-2 text-sm font-medium disabled:opacity-60 bg-white hover:bg-gray-50 text-gray-900 border-gray-300 shadow-sm"
    >
      {isRunning ? "Reconciling..." : "Reconcile Checkouts"}
    </button>
  );
}
