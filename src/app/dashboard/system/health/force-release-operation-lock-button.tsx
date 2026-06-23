"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ReleaseResponse = {
  message: string;
};

export default function ForceReleaseOperationLockButton() {
  const router = useRouter();

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isReleasing, setIsReleasing] = useState(false);

  async function releaseLock() {
    const confirmed = window.confirm(
      "Force release the production operation lock? Only do this if you are sure no deploy, rollback, backup, or restore process is still running.",
    );

    if (!confirmed) return;

    setMessage("");
    setError("");
    setIsReleasing(true);

    try {
      const response = await fetch("/api/system/operation-lock/release", {
        method: "POST",
      });

      const data = (await response.json()) as ReleaseResponse;

      if (!response.ok) {
        setError(data.message);
        return;
      }

      setMessage(data.message);
      router.refresh();
    } catch {
      setError("Unable to release operation lock.");
    } finally {
      setIsReleasing(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={releaseLock}
        disabled={isReleasing}
        className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isReleasing ? "Releasing..." : "Force Release Lock"}
      </button>

      {message && <p className="mt-2 text-xs text-green-700">{message}</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
