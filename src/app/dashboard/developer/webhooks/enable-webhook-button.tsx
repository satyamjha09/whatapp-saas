"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type EnableWebhookButtonProps = {
  endpointId: string;
};

type EnableWebhookResponse = {
  message: string;
};

export default function EnableWebhookButton({
  endpointId,
}: EnableWebhookButtonProps) {
  const router = useRouter();

  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function enableWebhook() {
    const confirmed = window.confirm(
      "Re-enable this webhook? Make sure the receiver endpoint is fixed before enabling it.",
    );

    if (!confirmed) return;

    setError("");
    setIsSaving(true);

    try {
      const response = await fetch(
        `/api/developer/webhooks/${endpointId}/enable`,
        {
          method: "POST",
        },
      );
      const data = (await response.json()) as EnableWebhookResponse;

      if (!response.ok) {
        setError(data.message);
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to enable webhook.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={enableWebhook}
        disabled={isSaving}
        className="rounded-lg bg-black px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? "Enabling..." : "Re-enable"}
      </button>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
