"use client";

import { LoaderCircle, PauseCircle, PlayCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SubscriptionCancelResumeButton({
  billingPlan,
  canManage,
  cancelAtPeriodEnd,
  subscriptionStatus,
}: {
  billingPlan: string;
  canManage: boolean;
  cancelAtPeriodEnd: boolean;
  subscriptionStatus: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (billingPlan === "FREE" || (!cancelAtPeriodEnd && subscriptionStatus !== "ACTIVE")) {
    return null;
  }

  async function runAction() {
    const action = cancelAtPeriodEnd ? "resume" : "cancel";
    const confirmed = window.confirm(
      cancelAtPeriodEnd
        ? "Resume this subscription and keep the paid plan active?"
        : "Cancel this subscription at the end of its current paid period?",
    );
    if (!confirmed) return;

    setError("");
    setIsSaving(true);
    try {
      const response = await fetch(`/api/billing/subscription/${action}`, {
        method: "POST",
      });
      const data = (await response.json()) as { message: string };
      if (!response.ok) throw new Error(data.message);
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update subscription.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void runAction()}
        disabled={!canManage || isSaving}
        className={`inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-55 ${cancelAtPeriodEnd ? "border-[#128C7E] bg-[#128C7E] text-white hover:bg-[#075E54]" : "border-rose-200 bg-white text-rose-700 hover:bg-rose-50"}`}
      >
        {isSaving ? (
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
        ) : cancelAtPeriodEnd ? (
          <PlayCircle className="mr-2 h-4 w-4" />
        ) : (
          <PauseCircle className="mr-2 h-4 w-4" />
        )}
        {isSaving
          ? "Saving..."
          : cancelAtPeriodEnd
            ? "Resume subscription"
            : "Cancel at period end"}
      </button>
      {error ? <p role="alert" className="mt-2 max-w-72 text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
