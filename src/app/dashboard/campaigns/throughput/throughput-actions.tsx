"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ThroughputPolicyActions({
  campaignId,
  currentMode,
}: {
  campaignId: string;
  currentMode: string;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  async function patchPolicy(body: Record<string, unknown>) {
    setIsSaving(true);

    try {
      const response = await fetch(`/api/campaign-throughput/${campaignId}/policy`, {
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        window.alert(payload?.message ?? "Unable to update throughput policy.");
        return;
      }

      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  function editLimits() {
    const maxPerMinute = window.prompt("Max messages per minute:");
    const maxPerHour = window.prompt("Max messages per hour:");
    const minDelayMs = window.prompt("Minimum delay between sends in ms:");

    void patchPolicy({
      maxPerHour: maxPerHour ? Number(maxPerHour) : undefined,
      maxPerMinute: maxPerMinute ? Number(maxPerMinute) : undefined,
      minDelayMs: minDelayMs ? Number(minDelayMs) : undefined,
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => void patchPolicy({ mode: "NORMAL" })}
        disabled={isSaving || currentMode === "NORMAL"}
        className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
      >
        Normal
      </button>
      <button
        type="button"
        onClick={() => void patchPolicy({ mode: "SLOW" })}
        disabled={isSaving || currentMode === "SLOW"}
        className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
      >
        Slow
      </button>
      <button
        type="button"
        onClick={() => void patchPolicy({ mode: "PAUSED" })}
        disabled={isSaving || currentMode === "PAUSED"}
        className="rounded-lg border px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-50"
      >
        Pause
      </button>
      <button
        type="button"
        onClick={editLimits}
        disabled={isSaving}
        className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
      >
        Edit Limits
      </button>
    </div>
  );
}
