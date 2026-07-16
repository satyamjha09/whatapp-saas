"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type SubscriptionOption = {
  id: string;
  label: string;
  partnerName: string;
  clientName: string;
  billingOwnerType: string;
};

type InvoiceOption = {
  id: string;
  label: string;
  paymentStatus: string;
};

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message || "Request failed");
  }

  return payload;
}

export function GeneratePartnerInvoiceForm({
  canManage,
  subscriptions,
}: {
  canManage: boolean;
  subscriptions: SubscriptionOption[];
}) {
  const router = useRouter();
  const [subscriptionId, setSubscriptionId] = useState(subscriptions[0]?.id ?? "");
  const [dueAt, setDueAt] = useState("");
  const [issueImmediately, setIssueImmediately] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await postJson("/api/platform/partner-billing/invoices", {
        subscriptionId,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        issueImmediately,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate invoices");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
        Generate billing
      </p>
      <h2 className="mt-1 text-xl font-black text-slate-950">
        Invoice subscription period
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Creates MetaWhat-to-partner wholesale billing and, when partner-owned,
        partner-to-client retail billing.
      </p>

      <label className="mt-4 block text-sm font-bold text-slate-700">
        Subscription
      </label>
      <select
        className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
        disabled={!canManage || loading || subscriptions.length === 0}
        value={subscriptionId}
        onChange={(event) => setSubscriptionId(event.target.value)}
      >
        {subscriptions.map((subscription) => (
          <option key={subscription.id} value={subscription.id}>
            {subscription.label}
          </option>
        ))}
      </select>

      <label className="mt-4 block text-sm font-bold text-slate-700">
        Due date
      </label>
      <input
        className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
        disabled={!canManage || loading}
        type="datetime-local"
        value={dueAt}
        onChange={(event) => setDueAt(event.target.value)}
      />

      <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
        <input
          checked={issueImmediately}
          disabled={!canManage || loading}
          type="checkbox"
          onChange={(event) => setIssueImmediately(event.target.checked)}
        />
        Issue invoice immediately
      </label>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <button
        className="mt-5 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canManage || loading || !subscriptionId}
        type="submit"
      >
        {loading ? "Generating..." : "Generate invoices"}
      </button>
    </form>
  );
}

export function PartnerBillingOwnerForm({
  canManage,
  subscriptions,
}: {
  canManage: boolean;
  subscriptions: SubscriptionOption[];
}) {
  const router = useRouter();
  const [subscriptionId, setSubscriptionId] = useState(subscriptions[0]?.id ?? "");
  const [billingOwnerType, setBillingOwnerType] = useState("PARENT_PARTNER");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await postJson(
        `/api/platform/partner-billing/subscriptions/${subscriptionId}/billing-owner`,
        {
          billingOwnerType,
        },
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update owner");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-700">
        Billing owner
      </p>
      <h2 className="mt-1 text-xl font-black text-slate-950">
        Select who bills the client
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Partner-owned clients get retail invoices from the partner. Self-owned
        clients do not generate partner-to-client retail invoices.
      </p>

      <label className="mt-4 block text-sm font-bold text-slate-700">
        Subscription
      </label>
      <select
        className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
        disabled={!canManage || loading || subscriptions.length === 0}
        value={subscriptionId}
        onChange={(event) => setSubscriptionId(event.target.value)}
      >
        {subscriptions.map((subscription) => (
          <option key={subscription.id} value={subscription.id}>
            {subscription.clientName} via {subscription.partnerName}
          </option>
        ))}
      </select>

      <label className="mt-4 block text-sm font-bold text-slate-700">
        Owner
      </label>
      <select
        className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
        disabled={!canManage || loading}
        value={billingOwnerType}
        onChange={(event) => setBillingOwnerType(event.target.value)}
      >
        <option value="PARENT_PARTNER">Parent partner</option>
        <option value="SELF">Client self-billing</option>
      </select>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <button
        className="mt-5 rounded-xl border border-emerald-200 px-4 py-2 text-sm font-bold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canManage || loading || !subscriptionId}
        type="submit"
      >
        {loading ? "Saving..." : "Save billing owner"}
      </button>
    </form>
  );
}

export function PartnerBillingPaymentForm({
  canManage,
  invoices,
}: {
  canManage: boolean;
  invoices: InvoiceOption[];
}) {
  const router = useRouter();
  const [invoiceId, setInvoiceId] = useState(invoices[0]?.id ?? "");
  const [paymentReference, setPaymentReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await postJson(`/api/platform/partner-billing/invoices/${invoiceId}/payment`, {
        paymentStatus: "PAID",
        paymentProvider: "manual",
        paymentReference: paymentReference || undefined,
      });
      setPaymentReference("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to mark paid");
    } finally {
      setLoading(false);
    }
  }

  async function scanOverdue() {
    setLoading(true);
    setError(null);

    try {
      await postJson("/api/platform/partner-billing/invoices/mark-overdue", {});
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to scan overdue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-700">
        Collection
      </p>
      <h2 className="mt-1 text-xl font-black text-slate-950">
        Payment collection
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Record manual payments and run overdue handling while payment gateway
        collection is connected later.
      </p>

      <label className="mt-4 block text-sm font-bold text-slate-700">
        Invoice
      </label>
      <select
        className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
        disabled={!canManage || loading || invoices.length === 0}
        value={invoiceId}
        onChange={(event) => setInvoiceId(event.target.value)}
      >
        {invoices.map((invoice) => (
          <option key={invoice.id} value={invoice.id}>
            {invoice.label}
          </option>
        ))}
      </select>

      <label className="mt-4 block text-sm font-bold text-slate-700">
        Payment reference
      </label>
      <input
        className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
        disabled={!canManage || loading}
        value={paymentReference}
        onChange={(event) => setPaymentReference(event.target.value)}
        placeholder="UTR / gateway payment id"
      />

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canManage || loading || !invoiceId}
          type="submit"
        >
          Mark paid
        </button>
        <button
          className="rounded-xl border px-4 py-2 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canManage || loading}
          type="button"
          onClick={scanOverdue}
        >
          Scan overdue
        </button>
      </div>
    </form>
  );
}
