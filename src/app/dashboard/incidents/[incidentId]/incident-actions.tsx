"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function IncidentActions({
  incidentId,
  status,
}: {
  incidentId: string;
  status: string;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function run(action: "acknowledge" | "resolve") {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/incidents/${incidentId}/${action}`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to update incident");
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to update incident");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {status === "OPEN" && (
        <button
          type="button"
          onClick={() => run("acknowledge")}
          disabled={isLoading}
          className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          Acknowledge
        </button>
      )}

      {status !== "RESOLVED" && (
        <button
          type="button"
          onClick={() => run("resolve")}
          disabled={isLoading}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Resolve
        </button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
