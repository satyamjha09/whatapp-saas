"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type PartnerOption = {
  id: string;
  name: string;
};

type AccrualOption = {
  id: string;
  label: string;
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

export function CommissionRuleForm({
  canManage,
  partners,
}: {
  canManage: boolean;
  partners: PartnerOption[];
}) {
  const router = useRouter();
  const [partnerCompanyId, setPartnerCompanyId] = useState(partners[0]?.id ?? "");
  const [planCode, setPlanCode] = useState("");
  const [percentageBps, setPercentageBps] = useState("2000");
  const [fixedAmountPaise, setFixedAmountPaise] = useState("");
  const [holdDays, setHoldDays] = useState("14");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await postJson("/api/platform/partner-commissions", {
        action: "create_rule",
        partnerCompanyId,
        planCode: planCode || undefined,
        percentageBps: percentageBps ? Number(percentageBps) : undefined,
        fixedAmountPaise: fixedAmountPaise ? Number(fixedAmountPaise) : undefined,
        holdDays: Number(holdDays || 14),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save commission rule");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="rounded-2xl border bg-white p-5 shadow-sm" onSubmit={onSubmit}>
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
        Referral rules
      </p>
      <h2 className="mt-1 text-xl font-black text-slate-950">
        Create commission rule
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Rules apply to referral/self-billed clients. Reseller clients earn margin
        through partner billing instead.
      </p>

      <label className="mt-4 block text-sm font-bold text-slate-700">
        Partner
      </label>
      <select
        className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
        disabled={!canManage || loading || partners.length === 0}
        value={partnerCompanyId}
        onChange={(event) => setPartnerCompanyId(event.target.value)}
      >
        {partners.map((partner) => (
          <option key={partner.id} value={partner.id}>
            {partner.name}
          </option>
        ))}
      </select>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-bold text-slate-700">
          Plan
          <select
            className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
            disabled={!canManage || loading}
            value={planCode}
            onChange={(event) => setPlanCode(event.target.value)}
          >
            <option value="">All plans</option>
            <option value="FREE">Free</option>
            <option value="STARTER">Starter</option>
            <option value="GROWTH">Growth</option>
            <option value="BUSINESS">Business</option>
            <option value="ENTERPRISE">Enterprise</option>
          </select>
        </label>
        <label className="block text-sm font-bold text-slate-700">
          Hold days
          <input
            className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
            disabled={!canManage || loading}
            min={0}
            type="number"
            value={holdDays}
            onChange={(event) => setHoldDays(event.target.value)}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-bold text-slate-700">
          Percentage bps
          <input
            className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
            disabled={!canManage || loading}
            max={10000}
            min={0}
            type="number"
            value={percentageBps}
            onChange={(event) => setPercentageBps(event.target.value)}
          />
        </label>
        <label className="block text-sm font-bold text-slate-700">
          Fixed amount paise
          <input
            className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
            disabled={!canManage || loading}
            min={0}
            type="number"
            value={fixedAmountPaise}
            onChange={(event) => setFixedAmountPaise(event.target.value)}
          />
        </label>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <button
        className="mt-5 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canManage || loading || !partnerCompanyId}
        type="submit"
      >
        {loading ? "Saving..." : "Save rule"}
      </button>
    </form>
  );
}

export function CommissionOperationsForm({
  canManage,
  reversibleAccruals,
}: {
  canManage: boolean;
  reversibleAccruals: AccrualOption[];
}) {
  const router = useRouter();
  const [partnerBillingInvoiceId, setPartnerBillingInvoiceId] = useState("");
  const [accrualId, setAccrualId] = useState(reversibleAccruals[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function runAction(body: unknown) {
    setLoading(true);
    setError(null);

    try {
      await postJson("/api/platform/partner-commissions", body);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-700">
        Accrual operations
      </p>
      <h2 className="mt-1 text-xl font-black text-slate-950">
        Accrue, release, reverse
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Create a commission from a paid referral invoice, release hold-period
        commissions, or create a negative reversal record.
      </p>

      <label className="mt-4 block text-sm font-bold text-slate-700">
        Paid partner billing invoice ID
      </label>
      <input
        className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
        disabled={!canManage || loading}
        placeholder="PartnerBillingInvoice ID"
        value={partnerBillingInvoiceId}
        onChange={(event) => setPartnerBillingInvoiceId(event.target.value)}
      />

      <button
        className="mt-3 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canManage || loading || !partnerBillingInvoiceId}
        type="button"
        onClick={() =>
          runAction({
            action: "accrue_invoice",
            partnerBillingInvoiceId,
          })
        }
      >
        Accrue commission
      </button>

      <div className="my-5 border-t" />

      <button
        className="rounded-xl border px-4 py-2 text-sm font-bold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canManage || loading}
        type="button"
        onClick={() => runAction({ action: "mark_available" })}
      >
        Release available holds
      </button>

      <div className="my-5 border-t" />

      <label className="block text-sm font-bold text-slate-700">
        Accrual to reverse
      </label>
      <select
        className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
        disabled={!canManage || loading || reversibleAccruals.length === 0}
        value={accrualId}
        onChange={(event) => setAccrualId(event.target.value)}
      >
        {reversibleAccruals.map((accrual) => (
          <option key={accrual.id} value={accrual.id}>
            {accrual.label}
          </option>
        ))}
      </select>
      <textarea
        className="mt-3 min-h-20 w-full rounded-xl border px-3 py-2 text-sm"
        disabled={!canManage || loading}
        placeholder="Reason for reversal"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <button
        className="mt-3 rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canManage || loading || !accrualId || reason.length < 3}
        type="button"
        onClick={() =>
          runAction({
            action: "reverse",
            accrualId,
            reason,
          })
        }
      >
        Create reversal
      </button>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
