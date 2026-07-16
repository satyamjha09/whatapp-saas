"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type PartnerBalanceOption = {
  id: string;
  name: string;
  availablePaise: number;
};

type PayoutOption = {
  id: string;
  label: string;
  status: string;
};

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message || "Request failed");
  }

  return payload;
}

export function RequestPayoutForm({
  canApprove,
  partners,
}: {
  canApprove: boolean;
  partners: PartnerBalanceOption[];
}) {
  const router = useRouter();
  const [partnerCompanyId, setPartnerCompanyId] = useState(partners[0]?.id ?? "");
  const selectedPartner = partners.find((partner) => partner.id === partnerCompanyId);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await postJson("/api/platform/partner-payouts", {
        partnerCompanyId,
        amountPaise: selectedPartner?.availablePaise ?? 0,
        notes: notes || undefined,
      });
      setNotes("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to request payout");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="rounded-2xl border bg-white p-5 shadow-sm" onSubmit={onSubmit}>
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
        Payout request
      </p>
      <h2 className="mt-1 text-xl font-black text-slate-950">
        Request full available balance
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        The first payout flow pays the full available partner balance to avoid
        partial-ledger ambiguity.
      </p>

      <label className="mt-4 block text-sm font-bold text-slate-700">
        Partner
      </label>
      <select
        className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
        disabled={!canApprove || loading || partners.length === 0}
        value={partnerCompanyId}
        onChange={(event) => setPartnerCompanyId(event.target.value)}
      >
        {partners.map((partner) => (
          <option key={partner.id} value={partner.id}>
            {partner.name} - available {partner.availablePaise / 100}
          </option>
        ))}
      </select>

      <textarea
        className="mt-4 min-h-20 w-full rounded-xl border px-3 py-2 text-sm"
        disabled={!canApprove || loading}
        placeholder="Optional payout note"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <button
        className="mt-5 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        disabled={
          !canApprove ||
          loading ||
          !partnerCompanyId ||
          !selectedPartner ||
          selectedPartner.availablePaise <= 0
        }
        type="submit"
      >
        {loading ? "Requesting..." : "Request payout"}
      </button>
    </form>
  );
}

export function PayoutApprovalForm({
  canApprove,
  payouts,
}: {
  canApprove: boolean;
  payouts: PayoutOption[];
}) {
  const router = useRouter();
  const [payoutId, setPayoutId] = useState(payouts[0]?.id ?? "");
  const [bankReference, setBankReference] = useState("");
  const [failureReason, setFailureReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function runAction(url: string, body: unknown) {
    setLoading(true);
    setError(null);

    try {
      await postJson(url, body);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payout action failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-700">
        Approval and payment
      </p>
      <h2 className="mt-1 text-xl font-black text-slate-950">
        Approve or reconcile payout
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Approval and payment are separate actions so finance can reconcile bank
        transfer status safely.
      </p>

      <label className="mt-4 block text-sm font-bold text-slate-700">
        Payout
      </label>
      <select
        className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
        disabled={!canApprove || loading || payouts.length === 0}
        value={payoutId}
        onChange={(event) => setPayoutId(event.target.value)}
      >
        {payouts.map((payout) => (
          <option key={payout.id} value={payout.id}>
            {payout.label}
          </option>
        ))}
      </select>

      <textarea
        className="mt-4 min-h-16 w-full rounded-xl border px-3 py-2 text-sm"
        disabled={!canApprove || loading}
        placeholder="Approval or payment note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input
          className="rounded-xl border px-3 py-2 text-sm"
          disabled={!canApprove || loading}
          placeholder="Bank reference / UTR"
          value={bankReference}
          onChange={(event) => setBankReference(event.target.value)}
        />
        <input
          className="rounded-xl border px-3 py-2 text-sm"
          disabled={!canApprove || loading}
          placeholder="Failure reason"
          value={failureReason}
          onChange={(event) => setFailureReason(event.target.value)}
        />
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canApprove || loading || !payoutId}
          type="button"
          onClick={() =>
            runAction(`/api/platform/partner-payouts/${payoutId}/approve`, {
              note: note || undefined,
            })
          }
        >
          Approve
        </button>
        <button
          className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canApprove || loading || !payoutId}
          type="button"
          onClick={() =>
            runAction(`/api/platform/partner-payouts/${payoutId}/payment`, {
              status: "PAID",
              bankReference: bankReference || undefined,
              note: note || undefined,
            })
          }
        >
          Mark paid
        </button>
        <button
          className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canApprove || loading || !payoutId}
          type="button"
          onClick={() =>
            runAction(`/api/platform/partner-payouts/${payoutId}/payment`, {
              status: "FAILED",
              failureReason: failureReason || "Bank transfer failed",
              note: note || undefined,
            })
          }
        >
          Mark failed
        </button>
      </div>
    </div>
  );
}
