"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ban, RefreshCcw } from "lucide-react";

type BroadcastCampaignActionsProps = {
  campaignId: string;
  canCancel: boolean;
};

const buttonClass =
  "inline-flex items-center justify-center rounded-xl border border-[#BFE9D0] bg-white px-4 py-2 text-sm font-semibold text-[#128C7E] transition hover:border-[#128C7E] hover:bg-[#E7F8EF] disabled:cursor-not-allowed disabled:opacity-50";

const dangerButtonClass =
  "inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50";

export function BroadcastCampaignActions({
  campaignId,
  canCancel,
}: BroadcastCampaignActionsProps) {
  const router = useRouter();
  const [isCanceling, setIsCanceling] = useState(false);
  const [message, setMessage] = useState("");

  async function cancelCampaign() {
    if (!window.confirm("Cancel this active campaign launch?")) return;

    setIsCanceling(true);
    setMessage("");

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/cancel`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || "Unable to cancel campaign.");
      }

      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cancel failed.");
    } finally {
      setIsCanceling(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          className={dangerButtonClass}
          disabled={!canCancel || isCanceling}
          onClick={cancelCampaign}
          title={
            canCancel
              ? "Cancel active launch run"
              : "Only active launch runs can be canceled"
          }
          type="button"
        >
          <Ban className="mr-2 h-4 w-4" />
          Cancel launch
        </button>
        <button
          className={buttonClass}
          disabled
          title="Retry failed recipients is available from the failures workspace in the next pass."
          type="button"
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          Retry failed
        </button>
      </div>
      {message ? (
        <p className="mt-2 text-xs font-medium text-rose-700">{message}</p>
      ) : null}
    </div>
  );
}
