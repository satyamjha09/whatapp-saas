"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ImportJob = {
  id: string;
  totalRows: number;
  readyRows: number;
  skippedRows: number;
  importedRows: number;
  failedRows: number;
  status: string;
  rows: Array<{
    id: string;
    rowNumber: number;
    status: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    errorMessage?: string | null;
    consentStatus?: string | null;
    consentProof?: string | null;
  }>;
};

export function ContactImportForm() {
  const router = useRouter();

  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [job, setJob] = useState<ImportJob | null>(null);
  const [error, setError] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  const [fieldMapping, setFieldMapping] = useState({
    name: "name",
    email: "email",
    phone: "phone",
    city: "city",
    companyName: "companyName",
  });

  const [consentMapping, setConsentMapping] = useState({
    marketingConsentStatus: "marketingConsentStatus",
    marketingConsentProof: "marketingConsentProof",
    marketingConsentSource: "marketingConsentSource",
  });

  async function readFile(file: File) {
    setFileName(file.name);
    setCsvText(await file.text());
  }

  async function preview() {
    setError("");
    setIsWorking(true);

    try {
      const response = await fetch("/api/contacts/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName,
          csvText,
          fieldMapping,
          consentMapping,
          duplicateStrategy: "UPDATE_EXISTING",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to preview import.");
        return;
      }

      setJob(data.job);
      router.refresh();
    } finally {
      setIsWorking(false);
    }
  }

  async function runImport() {
    if (!job) return;

    setError("");
    setIsWorking(true);

    try {
      const response = await fetch(`/api/contacts/import/${job.id}/run`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to run import.");
        return;
      }

      router.refresh();
      setJob({
        ...job,
        status: data.job.status,
        importedRows: data.job.importedRows,
        failedRows: data.job.failedRows,
      });
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">
          Upload contacts CSV
        </h2>

        <p className="mt-2 text-sm text-gray-600">
          Required column: phone or email. For campaign-ready contacts, include consent proof.
        </p>

        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
          }}
          className="mt-5 block w-full rounded-xl border p-3 text-sm"
        />

        <div className="mt-5 rounded-xl bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-900">Field mapping</p>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {Object.keys(fieldMapping).map((key) => (
              <label key={key} className="block">
                <span className="text-xs font-semibold text-gray-600">{key}</span>
                <input
                  value={fieldMapping[key as keyof typeof fieldMapping]}
                  onChange={(event) =>
                    setFieldMapping((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  className="mt-1 h-10 w-full rounded-xl border px-3 text-sm"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-xl bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">
            Consent mapping
          </p>

          <div className="mt-3 grid gap-3">
            {Object.keys(consentMapping).map((key) => (
              <label key={key} className="block">
                <span className="text-xs font-semibold text-emerald-800">{key}</span>
                <input
                  value={consentMapping[key as keyof typeof consentMapping]}
                  onChange={(event) =>
                    setConsentMapping((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  className="mt-1 h-10 w-full rounded-xl border px-3 text-sm"
                />
              </label>
            ))}
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={preview}
            disabled={isWorking || !csvText.trim()}
            className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-60 text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            Preview Import
          </button>

          {job && job.status === "PREVIEWED" && (
            <button
              type="button"
              onClick={runImport}
              disabled={isWorking || job.readyRows === 0}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60 hover:bg-emerald-700 transition-colors"
            >
              Run Import
            </button>
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">
          Preview
        </h2>

        {!job ? (
          <p className="mt-4 text-sm text-gray-500">
            Upload CSV and click Preview Import.
          </p>
        ) : (
          <div className="mt-5">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-xl font-bold">{job.totalRows}</p>
              </div>

              <div className="rounded-xl bg-green-50 p-3">
                <p className="text-xs text-green-700">Ready</p>
                <p className="text-xl font-bold text-green-700">
                  {job.readyRows}
                </p>
              </div>

              <div className="rounded-xl bg-red-50 p-3">
                <p className="text-xs text-red-700">Skipped</p>
                <p className="text-xl font-bold text-red-700">
                  {job.skippedRows}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {job.rows.map((row) => (
                <article key={row.id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-900">
                        Row {row.rowNumber}: {row.name || row.phone || row.email}
                      </p>

                      <p className="text-xs text-gray-500">
                        {row.phone ?? "-"} · {row.email ?? "-"}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        Consent: {row.consentStatus ?? "UNKNOWN"}
                      </p>

                      {row.errorMessage && (
                        <p className="mt-2 text-sm text-red-600">
                          {row.errorMessage}
                        </p>
                      )}
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        row.status === "READY"
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {row.status}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
