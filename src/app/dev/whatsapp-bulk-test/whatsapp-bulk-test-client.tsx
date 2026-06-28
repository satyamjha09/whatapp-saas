"use client";

import { LoaderCircle, Send } from "lucide-react";
import { useState } from "react";

type ApiResult = {
  message?: string;
  company?: {
    id: string;
    name: string;
  };
  template?: {
    id: string;
    name: string;
    language: string;
  };
  result?: {
    batchId: string;
    requestedCount: number;
    queuedCount: number;
    failedCount: number;
    skippedDuplicateCount: number;
    skippedBlockedCount: number;
    missingMarketingConsent: number;
    status: string;
  };
};

export default function DevWhatsAppBulkTestClient() {
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState("");

  async function sendTest() {
    setIsSending(true);
    setResult(null);
    setError("");

    try {
      const response = await fetch("/api/dev/whatsapp-bulk-test", {
        method: "POST",
      });
      const data = (await response.json()) as ApiResult;

      if (!response.ok) {
        setError(data.message ?? "Unable to queue bulk test.");
        return;
      }

      setResult(data);
    } catch {
      setError("Unable to queue bulk test.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-[#D8E6F3]">
      <div className="grid gap-4 text-sm text-[#526173] sm:grid-cols-2">
        <div className="rounded-xl bg-[#F7FAFC] p-4 ring-1 ring-[#E5EEF8]">
          <p className="font-bold text-[#081B3A]">Template</p>
          <p className="mt-1">hello_world / en_US</p>
        </div>
        <div className="rounded-xl bg-[#F7FAFC] p-4 ring-1 ring-[#E5EEF8]">
          <p className="font-bold text-[#081B3A]">Recipients</p>
          <p className="mt-1">4 test numbers</p>
        </div>
      </div>

      <button
        type="button"
        onClick={sendTest}
        disabled={isSending}
        className="mt-6 inline-flex items-center rounded-xl bg-[#0052CC] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#003F9E] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSending ? (
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Send className="mr-2 h-4 w-4" />
        )}
        {isSending ? "Queueing..." : "Send Bulk Test"}
      </button>

      {error ? (
        <div className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-800 ring-1 ring-emerald-200">
          <p className="font-bold">{result.message}</p>
          <p className="mt-2">Company: {result.company?.name}</p>
          <p>Batch: {result.result?.batchId}</p>
          <p>
            Queued: {result.result?.queuedCount} / Requested:{" "}
            {result.result?.requestedCount}
          </p>
          <p>Status: {result.result?.status}</p>
        </div>
      ) : null}
    </section>
  );
}
