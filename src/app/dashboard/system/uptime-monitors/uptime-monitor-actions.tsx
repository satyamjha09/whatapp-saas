"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RunUptimeCheckButton({ monitorId }: { monitorId: string }) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState("");

  async function check() {
    setIsChecking(true);
    setError("");

    try {
      const response = await fetch(`/api/system/uptime-monitors/${monitorId}/check`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to run check");
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to run check");
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={check}
        disabled={isChecking}
        className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-60"
      >
        {isChecking ? "Checking..." : "Check Now"}
      </button>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
