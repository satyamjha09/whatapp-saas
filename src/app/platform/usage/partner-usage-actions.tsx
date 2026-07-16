"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.message || "Action failed.");
  }

  return payload;
}

export function PartnerUsageActions({
  exportHref,
}: {
  exportHref: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runAggregation() {
    setLoading(true);
    setMessage(null);

    try {
      const payload = await postJson("/api/platform/partner-usage", {
        action: "aggregate",
        date: new Date().toISOString(),
      });
      setMessage(
        `Aggregated ${payload.result.createdOrUpdated} subscriptions with ${payload.result.openAlerts} open alerts.`,
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Aggregation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={runAggregation}
        disabled={loading}
        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Aggregating..." : "Run daily aggregation"}
      </button>
      <a
        href={exportHref}
        className="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-black text-emerald-700 hover:bg-emerald-50"
      >
        Export CSV
      </a>
      {message ? <p className="text-sm font-semibold text-slate-600">{message}</p> : null}
    </div>
  );
}
