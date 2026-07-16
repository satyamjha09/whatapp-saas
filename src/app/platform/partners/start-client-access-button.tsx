"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";

export function StartClientAccessButton({
  clientCompanyId,
}: {
  clientCompanyId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startAccess() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/partner/client-access/sessions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          clientCompanyId,
          reason: "Opened from platform partner clients dashboard.",
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to start client access.");
      }

      window.location.href = data.redirectTo || "/dashboard";
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to start client access.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={startAccess}
        disabled={busy}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {busy ? "Opening..." : "Open client workspace"}
      </button>
      {error ? (
        <p className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
