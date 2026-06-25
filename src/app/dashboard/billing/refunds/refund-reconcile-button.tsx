"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReconcileRefundsButton() {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);

  async function run() {
    setIsRunning(true);
    try {
      await fetch("/api/billing/refunds/reconcile", {
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
      className="rounded-xl border px-4 py-2 text-sm font-medium disabled:opacity-60"
    >
      {isRunning ? "Reconciling..." : "Reconcile Refunds"}
    </button>
  );
}
