"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SegmentPreviewButton({ segmentId }: { segmentId: string }) {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");

  async function preview() {
    setIsRunning(true);
    setError("");

    try {
      const response = await fetch(`/api/contact-segments/${segmentId}/preview`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to preview segment.");
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to preview segment.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={preview}
        disabled={isRunning}
        className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
      >
        {isRunning ? "Previewing..." : "Preview"}
      </button>
      {error ? <p className="max-w-48 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
