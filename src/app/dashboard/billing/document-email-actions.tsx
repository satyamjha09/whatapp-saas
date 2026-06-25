"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SendInvoiceEmailButton({
  invoiceId,
}: {
  invoiceId: string;
}) {
  const router = useRouter();
  const [isSending, setIsSending] = useState(false);

  async function send() {
    setIsSending(true);

    try {
      await fetch(`/api/billing/invoices/${invoiceId}/send-email`, {
        method: "POST",
      });

      router.refresh();
    } finally {
      setIsSending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={send}
      disabled={isSending}
      className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-60 bg-white hover:bg-gray-50 border-gray-300 text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-950 transition"
    >
      {isSending ? "Sending..." : "Send Email"}
    </button>
  );
}

export function SendCreditNoteEmailButton({
  creditNoteId,
}: {
  creditNoteId: string;
}) {
  const router = useRouter();
  const [isSending, setIsSending] = useState(false);

  async function send() {
    setIsSending(true);

    try {
      await fetch(`/api/billing/credit-notes/${creditNoteId}/send-email`, {
        method: "POST",
      });

      router.refresh();
    } finally {
      setIsSending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={send}
      disabled={isSending}
      className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-60 bg-white hover:bg-gray-50 border-gray-300 text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-950 transition"
    >
      {isSending ? "Sending..." : "Send Email"}
    </button>
  );
}
