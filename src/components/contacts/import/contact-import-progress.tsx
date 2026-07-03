"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  actionButtonClass,
  StatusPill,
  statusTone,
} from "@/app/dashboard/dashboard-ui";
import type { ImportWizardJob } from "./types";

const ACTIVE_STATUSES = ["READY", "IMPORTING"];

export function ContactImportProgress({
  importId,
  initialJob,
}: {
  importId: string;
  initialJob?: ImportWizardJob | null;
}) {
  const [job, setJob] = useState<ImportWizardJob | null>(initialJob ?? null);
  const [error, setError] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/contacts/import/${importId}`);
      const data = await response.json();

      if (response.ok && data.job) {
        setJob(data.job as ImportWizardJob);
      }
    } catch {
      // Network hiccup during polling; the next tick retries.
    }
  }, [importId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh();
    }, 0);

    return () => clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    if (!job || !ACTIVE_STATUSES.includes(job.status)) return;

    const timer = setInterval(() => {
      void refresh();
    }, 2000);

    return () => clearInterval(timer);
  }, [job, refresh]);

  async function cancel() {
    setIsCancelling(true);
    setError("");

    try {
      const response = await fetch(`/api/contacts/import/${importId}/cancel`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to cancel import.");
        return;
      }

      await refresh();
    } finally {
      setIsCancelling(false);
    }
  }

  if (!job) {
    return <p className="text-sm text-[#526173]">Loading import status...</p>;
  }

  const processable = job.validRows + job.duplicateRows;
  const processed = job.importedRows + job.skippedRows + job.failedRows;
  const percent =
    job.status === "COMPLETED"
      ? 100
      : processable > 0
        ? Math.min(Math.round((processed / processable) * 100), 100)
        : 0;

  const counts = [
    { label: "Imported", value: job.importedRows, className: "text-[#15803d]" },
    { label: "Skipped", value: job.skippedRows, className: "text-amber-600" },
    { label: "Failed", value: job.failedRows, className: "text-rose-600" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <StatusPill tone={statusTone(job.status)}>{job.status}</StatusPill>
          <span className="text-sm text-[#526173]">
            {job.fileName ?? "Contact import"}
          </span>
        </div>

        {ACTIVE_STATUSES.includes(job.status) && (
          <button
            type="button"
            onClick={cancel}
            disabled={isCancelling}
            className="text-sm font-semibold text-rose-600 hover:underline disabled:opacity-50"
          >
            {isCancelling ? "Cancelling..." : "Cancel import"}
          </button>
        )}
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#E7F8EF]">
        <div
          className="h-full rounded-full bg-[#128C7E] transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-[#526173]">
        {processed.toLocaleString("en-IN")} of {processable.toLocaleString("en-IN")}{" "}
        rows processed ({percent}%)
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {counts.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-[#BFE9D0] bg-white p-4"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-[#526173]">
              {item.label}
            </p>
            <p className={`mt-1 text-2xl font-bold ${item.className}`}>
              {item.value.toLocaleString("en-IN")}
            </p>
          </div>
        ))}
      </div>

      {job.errorMessage && (
        <p className="mt-3 text-sm text-rose-600">{job.errorMessage}</p>
      )}

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {job.status === "COMPLETED" && (
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/dashboard/contacts" className={actionButtonClass("primary")}>
            View contacts
          </Link>
          <Link
            href="/dashboard/contacts/import"
            className={actionButtonClass("secondary")}
          >
            Import another file
          </Link>
        </div>
      )}
    </div>
  );
}
