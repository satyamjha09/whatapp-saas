"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type BackupResponse = {
  message: string;
  backup?: {
    fileName: string | null;
    sizeBytes: number | null;
  };
};

export default function RunDatabaseBackupButton() {
  const router = useRouter();

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  async function runBackup() {
    const confirmed = window.confirm(
      "Run a PostgreSQL database backup now? This may take a few minutes.",
    );

    if (!confirmed) return;

    setMessage("");
    setError("");
    setIsRunning(true);

    try {
      const response = await fetch("/api/system/backups/run", {
        method: "POST",
      });

      const data = (await response.json()) as BackupResponse;

      if (!response.ok) {
        setError(data.message);
        return;
      }

      setMessage(
        data.backup
          ? `Backup completed: ${data.backup.fileName ?? "backup file"}`
          : data.message,
      );

      router.refresh();
    } catch {
      setError("Unable to run database backup.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={runBackup}
        disabled={isRunning}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRunning ? "Running Backup..." : "Run Backup"}
      </button>

      {message && <p className="mt-2 text-xs text-green-700">{message}</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
