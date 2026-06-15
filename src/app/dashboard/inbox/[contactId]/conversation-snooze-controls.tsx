"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ConversationSnoozeControlsProps = {
  contactId: string;
  snoozedUntil: Date | null;
};

type SnoozeResponse = {
  message: string;
};

export default function ConversationSnoozeControls({
  contactId,
  snoozedUntil,
}: ConversationSnoozeControlsProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  async function updateSnooze(nextDate: Date | null) {
    setError("");
    setIsUpdating(true);

    try {
      const response = await fetch(`/api/inbox/${contactId}/snooze`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snoozedUntil: nextDate ? nextDate.toISOString() : null,
        }),
      });

      const data: SnoozeResponse = await response.json();

      if (!response.ok) {
        setError(data.message);
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to update snooze. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  }

  function addHours(hours: number) {
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  function addDays(days: number) {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  return (
    <div className="rounded-xl border bg-gray-50 p-3">
      <p className="mb-2 text-xs font-medium text-gray-500">Snooze</p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => updateSnooze(addHours(1))}
          disabled={isUpdating}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 disabled:opacity-60"
        >
          1 hour
        </button>
        <button
          type="button"
          onClick={() => updateSnooze(addDays(1))}
          disabled={isUpdating}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 disabled:opacity-60"
        >
          Tomorrow
        </button>
        <button
          type="button"
          onClick={() => updateSnooze(addDays(7))}
          disabled={isUpdating}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 disabled:opacity-60"
        >
          7 days
        </button>

        {snoozedUntil ? (
          <button
            type="button"
            onClick={() => updateSnooze(null)}
            disabled={isUpdating}
            className="rounded-lg bg-black px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
          >
            Unsnooze
          </button>
        ) : null}
      </div>

      {snoozedUntil ? (
        <p className="mt-2 text-xs text-gray-500">
          Snoozed until {snoozedUntil.toLocaleString()}
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
