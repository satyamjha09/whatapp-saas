"use client";

import { LoaderCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CancelScheduledCampaignButton({
  batchId,
}: {
  batchId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isCanceling, setIsCanceling] = useState(false);

  async function cancelCampaign() {
    if (
      !window.confirm(
        "Cancel this scheduled campaign? Its delayed jobs will be removed and queued messages will not be sent.",
      )
    ) {
      return;
    }

    setError("");
    setIsCanceling(true);

    try {
      const response = await fetch(`/api/campaigns/${batchId}/cancel`, {
        method: "POST",
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(data.message ?? "Unable to cancel scheduled campaign.");
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to cancel scheduled campaign.");
    } finally {
      setIsCanceling(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={cancelCampaign}
        disabled={isCanceling}
        className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isCanceling ? (
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <XCircle className="mr-2 h-4 w-4" />
        )}
        {isCanceling ? "Canceling..." : "Cancel Campaign"}
      </button>
      {error ? (
        <p className="mt-2 max-w-sm rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
