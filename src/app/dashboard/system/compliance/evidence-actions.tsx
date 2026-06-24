"use client";

import { FileJson, LoaderCircle, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

function isoDateTimeLocal(date: Date) {
  return date.toISOString().slice(0, 16);
}

export function CreateEvidenceExportForm({
  initialDateFrom,
  initialDateTo,
}: {
  initialDateFrom: string;
  initialDateTo: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [type, setType] = useState("COMPANY_COMPLIANCE");

  async function createExport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsCreating(true);

    const form = new FormData(event.currentTarget);
    const contactId = String(form.get("contactId") ?? "").trim();
    const dateFrom = String(form.get("dateFrom") ?? "");
    const dateTo = String(form.get("dateTo") ?? "");

    try {
      const response = await fetch("/api/system/compliance/evidence-exports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          contactId: contactId || null,
          dateFrom: new Date(dateFrom).toISOString(),
          dateTo: new Date(dateTo).toISOString(),
        }),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(data.message ?? "Unable to create export");
        return;
      }

      event.currentTarget.reset();
      setType("COMPANY_COMPLIANCE");
      router.refresh();
    } catch {
      setError("Unable to create export");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <form onSubmit={createExport} className="mt-4 grid gap-4 md:grid-cols-4">
      <div>
        <label className="text-sm font-medium text-gray-700">Type</label>
        <select
          name="type"
          value={type}
          onChange={(event) => setType(event.target.value)}
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
        >
          <option value="COMPANY_COMPLIANCE">Company Compliance</option>
          <option value="PRIVACY_COMPLIANCE">Privacy Compliance</option>
          <option value="SECURITY_COMPLIANCE">Security Compliance</option>
          <option value="RETENTION_COMPLIANCE">Retention Compliance</option>
          <option value="CONTACT_COMPLIANCE">Contact Compliance</option>
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700">Date From</label>
        <input
          name="dateFrom"
          type="datetime-local"
          defaultValue={isoDateTimeLocal(new Date(initialDateFrom))}
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700">Date To</label>
        <input
          name="dateTo"
          type="datetime-local"
          defaultValue={isoDateTimeLocal(new Date(initialDateTo))}
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700">Contact ID</label>
        <input
          name="contactId"
          placeholder="Only for Contact Compliance"
          disabled={type !== "CONTACT_COMPLIANCE"}
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
        />
      </div>

      <div className="md:col-span-4">
        <button
          type="submit"
          disabled={isCreating}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {isCreating ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <FileJson className="h-4 w-4" />
          )}
          {isCreating ? "Creating..." : "Create Evidence Export"}
        </button>

        {error ? (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function ProcessEvidenceExportButton({
  exportId,
}: {
  exportId: string;
}) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");

  async function process() {
    setIsProcessing(true);
    setError("");

    try {
      const response = await fetch(
        `/api/system/compliance/evidence-exports/${exportId}/process`,
        {
          method: "POST",
        },
      );
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(data.message ?? "Unable to process export");
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to process export");
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
        className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-60"
      >
        {isProcessing ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
        {isProcessing ? "Processing..." : "Process"}
      </button>

      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
