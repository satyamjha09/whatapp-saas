"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SecurityEventActionsProps = {
  eventId: string;
  isResolved: boolean;
};

type ApiResponse = {
  message: string;
};

export default function SecurityEventActions({
  eventId,
  isResolved,
}: SecurityEventActionsProps) {
  const router = useRouter();

  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(action: "resolve" | "reopen") {
    setMessage("");
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/security/events/${eventId}/${action}`, {
        method: "POST",
        headers:
          action === "resolve"
            ? {
                "Content-Type": "application/json",
              }
            : undefined,
        body:
          action === "resolve"
            ? JSON.stringify({
                resolutionNote: note || undefined,
              })
            : undefined,
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        setError(data.message);
        return;
      }

      setMessage(data.message);
      router.refresh();
    } catch {
      setError("Unable to update security event.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isResolved) {
    return (
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Actions</h2>

        <button
          type="button"
          onClick={() => submit("reopen")}
          disabled={isSubmitting}
          className="mt-4 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Reopening..." : "Reopen Event"}
        </button>

        {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Resolve Event</h2>

      <label className="mt-4 block text-sm font-medium text-gray-700">
        Resolution note
      </label>

      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={4}
        maxLength={1000}
        placeholder="Example: Allowed domain added to CSP extra script/connect source after verifying it is trusted."
        className="mt-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-gray-900"
      />

      <button
        type="button"
        onClick={() => submit("resolve")}
        disabled={isSubmitting}
        className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Resolving..." : "Resolve Event"}
      </button>

      {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
