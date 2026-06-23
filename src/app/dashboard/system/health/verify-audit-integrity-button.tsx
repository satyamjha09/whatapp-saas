"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type VerifyResponse = {
  checkedCount: number;
  failureCount: number;
  isHealthy: boolean;
};

export default function VerifyAuditIntegrityButton() {
  const router = useRouter();

  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  async function verify() {
    setError("");
    setResult(null);
    setIsVerifying(true);

    try {
      const response = await fetch("/api/system/audit-integrity/verify", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to verify audit integrity");
        return;
      }

      setResult(data as VerifyResponse);
      router.refresh();
    } catch {
      setError("Unable to verify audit integrity");
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={verify}
        disabled={isVerifying}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isVerifying ? "Verifying..." : "Verify Audit Integrity"}
      </button>

      {result && (
        <p className="mt-2 text-sm text-gray-700">
          Checked {result.checkedCount} logs. Failures: {result.failureCount}.
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
