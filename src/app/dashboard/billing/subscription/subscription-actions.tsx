"use client";

import { ArrowDownToLine, RotateCcw, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CancelAtPeriodEndButton() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function cancel() {
    setIsSaving(true);
    setError("");

    try {
      const response = await fetch(
        "/api/billing/scheduled-plan-change/cancel-at-period-end",
        {
          method: "POST",
        },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to schedule cancellation.");
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to schedule cancellation.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={cancel}
        disabled={isSaving}
        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
      >
        <XCircle className="h-4 w-4" />
        {isSaving ? "Scheduling..." : "Cancel at Period End"}
      </button>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export function UndoScheduledPlanChangeButton() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  async function undo() {
    setIsSaving(true);

    try {
      await fetch("/api/billing/scheduled-plan-change/undo", {
        method: "POST",
      });

      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={undo}
      disabled={isSaving}
      className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
    >
      <RotateCcw className="h-4 w-4" />
      {isSaving ? "Undoing..." : "Keep My Plan"}
    </button>
  );
}

export function DowngradeToFreeButton() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function downgrade() {
    setIsSaving(true);
    setError("");

    try {
      const response = await fetch("/api/billing/scheduled-plan-change/downgrade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          toPlan: "FREE",
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to schedule downgrade.");
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to schedule downgrade.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={downgrade}
        disabled={isSaving}
        className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-60"
      >
        <ArrowDownToLine className="h-4 w-4" />
        {isSaving ? "Scheduling..." : "Downgrade to Free at Period End"}
      </button>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
