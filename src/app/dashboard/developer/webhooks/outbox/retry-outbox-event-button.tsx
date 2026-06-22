"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RetryOutboxEventButton({
  outboxEventId,
  disabled,
}: {
  outboxEventId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState("");

  async function retry() {
    setError("");
    setIsRetrying(true);

    try {
      const response = await fetch(
        `/api/developer/webhooks/outbox/${outboxEventId}/retry`,
        { method: "POST" },
      );
      const data = (await response.json()) as { message: string };

      if (!response.ok) {
        setError(data.message);
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to retry webhook event.");
    } finally {
      setIsRetrying(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={retry}
        disabled={disabled || isRetrying}
        className="rounded-lg bg-[#0052CC] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isRetrying ? "Retrying..." : "Retry Event"}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
