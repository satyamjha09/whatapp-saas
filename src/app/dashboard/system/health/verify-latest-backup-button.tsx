"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type VerifyBackupResponse = {
  message: string;
  backup?: {
    fileName: string | null;
    verificationStatus: string;
  };
};

export default function VerifyLatestBackupButton() {
  const router = useRouter();

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  async function verifyBackup() {
    setMessage("");
    setError("");
    setIsVerifying(true);

    try {
      const response = await fetch("/api/system/backups/verify-latest", {
        method: "POST",
      });

      const data = (await response.json()) as VerifyBackupResponse;

      if (!response.ok) {
        setError(data.message);
        return;
      }

      setMessage(
        data.backup
          ? `Verified: ${data.backup.fileName ?? "latest backup"}`
          : data.message,
      );

      router.refresh();
    } catch {
      setError("Unable to verify latest backup.");
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={verifyBackup}
        disabled={isVerifying}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isVerifying ? "Verifying..." : "Verify Latest Backup"}
      </button>

      {message && <p className="mt-2 text-xs text-green-700">{message}</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
