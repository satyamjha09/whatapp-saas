"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function ManualReviewActionForm({
  checkoutId,
  action,
  buttonLabel,
  danger,
}: {
  checkoutId: string;
  action: "approve" | "reject";
  buttonLabel: string;
  danger?: boolean;
}) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setIsSaving(true);
    setError("");

    try {
      const response = await fetch(
        `/api/billing/ops/manual-reviews/${checkoutId}/${action}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            confirmation,
            notes,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Action failed.");
        return;
      }

      router.refresh();
    } catch {
      setError("Action failed.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        placeholder="CONFIRM_PAYMENT_REVIEW"
        className="w-full rounded-lg border px-3 py-2 text-xs"
      />

      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Review notes"
        rows={2}
        className="w-full rounded-lg border px-3 py-2 text-xs"
      />

      <button
        type="button"
        onClick={submit}
        disabled={isSaving}
        className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 ${
          danger ? "bg-red-600" : "bg-gray-900"
        }`}
      >
        {isSaving ? "Saving..." : buttonLabel}
      </button>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function ApproveManualReviewForm({
  checkoutId,
}: {
  checkoutId: string;
}) {
  return (
    <ManualReviewActionForm
      checkoutId={checkoutId}
      action="approve"
      buttonLabel="Approve"
    />
  );
}

export function RejectManualReviewForm({
  checkoutId,
}: {
  checkoutId: string;
}) {
  return (
    <ManualReviewActionForm
      checkoutId={checkoutId}
      action="reject"
      buttonLabel="Reject"
      danger
    />
  );
}
