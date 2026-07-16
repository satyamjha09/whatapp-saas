"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function RetryProvisioningButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setError(null);
    const response = await fetch(
      `/api/platform/partner-clients/provision/${jobId}/retry`,
      {
        method: "POST",
      },
    );
    const payload = (await response.json()) as {
      ok?: boolean;
      message?: string;
    };

    if (!response.ok || !payload.ok) {
      setError(payload.message ?? "Retry failed.");
      return;
    }

    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={retry}
        disabled={isPending}
        className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-white hover:bg-amber-600 disabled:bg-slate-300"
      >
        {isPending ? "Retrying..." : "Retry"}
      </button>
      {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}
    </div>
  );
}
