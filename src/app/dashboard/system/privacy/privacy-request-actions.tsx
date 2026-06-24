"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ProcessPrivacyRequestButton({
  requestId,
}: {
  requestId: string;
}) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");

  async function process() {
    setIsProcessing(true);
    setError("");

    try {
      const response = await fetch(`/api/privacy/requests/${requestId}/process`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to process request");
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to process request");
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={process}
        disabled={isProcessing}
        className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-60"
      >
        {isProcessing ? "Processing..." : "Process"}
      </button>

      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
