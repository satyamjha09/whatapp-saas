"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReprocessUnmappedWebhookButton({
  eventId,
  companies,
}: {
  eventId: string;
  companies: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [companyId, setCompanyId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function reprocess() {
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/platform/unmapped-webhook-events/${eventId}/reprocess`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId }),
        },
      );
      const data = (await response.json()) as {
        message?: string;
        errors?: { companyId?: string[] };
      };

      if (!response.ok) {
        setError(data.errors?.companyId?.[0] ?? data.message ?? "Unable to reprocess");
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to reprocess webhook.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select
          value={companyId}
          onChange={(event) => setCompanyId(event.target.value)}
          className="min-w-60 rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">Select company</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={reprocess}
          disabled={!companyId || isSubmitting}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Queueing..." : "Reprocess"}
        </button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
