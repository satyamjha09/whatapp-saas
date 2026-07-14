"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ban, Copy, Pause, Play } from "lucide-react";

type BroadcastDraftActionsProps = {
  draftId: string;
  status: string;
};

const smallButtonClass =
  "inline-flex items-center justify-center rounded-full border border-[#BFE9D0] bg-white px-3 py-1.5 text-xs font-semibold text-[#128C7E] transition hover:border-[#128C7E] hover:bg-[#E7F8EF] disabled:cursor-not-allowed disabled:opacity-50";

const dangerButtonClass =
  "inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50";

function controlActionForStatus(status: string) {
  if (["READY_TO_SEND", "SCHEDULED"].includes(status)) return "PAUSE";
  if (status === "PAUSED") return "RESUME";

  return null;
}

export function BroadcastDraftActions({
  draftId,
  status,
}: BroadcastDraftActionsProps) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function cloneDraft() {
    setBusyAction("CLONE");
    setMessage("");

    try {
      const response = await fetch(`/api/broadcast-drafts/${draftId}/clone`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || "Unable to clone broadcast.");
      }

      router.push(`/dashboard/broadcasts/${payload.draft.id}/edit`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Clone failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function updateControl(action: "PAUSE" | "RESUME" | "CANCEL") {
    if (
      action === "CANCEL" &&
      !window.confirm("Cancel this scheduled broadcast?")
    ) {
      return;
    }

    setBusyAction(action);
    setMessage("");

    try {
      const response = await fetch(`/api/broadcast-drafts/${draftId}/control`, {
        body: JSON.stringify({ action }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || "Unable to update broadcast.");
      }

      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Control failed.");
    } finally {
      setBusyAction(null);
    }
  }

  const controlAction = controlActionForStatus(status);
  const canCancel = ["READY_TO_SEND", "SCHEDULED", "PAUSED"].includes(status);
  const isBusy = Boolean(busyAction);

  return (
    <div className="mt-4 border-t border-[#BFE9D0] pt-3">
      <div className="flex flex-wrap gap-2">
        <button
          className={smallButtonClass}
          disabled={isBusy}
          onClick={cloneDraft}
          type="button"
        >
          <Copy className="mr-1.5 h-3.5 w-3.5" />
          Clone
        </button>

        {controlAction ? (
          <button
            className={smallButtonClass}
            disabled={isBusy}
            onClick={() => updateControl(controlAction)}
            type="button"
          >
            {controlAction === "PAUSE" ? (
              <Pause className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <Play className="mr-1.5 h-3.5 w-3.5" />
            )}
            {controlAction === "PAUSE" ? "Pause" : "Resume"}
          </button>
        ) : null}

        {canCancel ? (
          <button
            className={dangerButtonClass}
            disabled={isBusy}
            onClick={() => updateControl("CANCEL")}
            type="button"
          >
            <Ban className="mr-1.5 h-3.5 w-3.5" />
            Cancel
          </button>
        ) : null}
      </div>

      {message ? (
        <p className="mt-2 text-xs font-medium text-rose-700">{message}</p>
      ) : null}
    </div>
  );
}
