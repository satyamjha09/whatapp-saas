"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type PartnerOption = {
  id: string;
  name: string;
  status: string;
};

const PLAN_OPTIONS = ["FREE", "STARTER", "GROWTH", "BUSINESS", "ENTERPRISE"];

export function ProvisionClientForm({
  canManage,
  partners,
}: {
  canManage: boolean;
  partners: PartnerOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    partnerCompanyId: partners[0]?.id ?? "",
    requestedCompanyName: "",
    requestedOwnerEmail: "",
    requestedOwnerName: "",
    requestedPlan: "FREE",
    requestedPlanDays: 14,
    externalClientReference: "",
  });
  const canSubmit = useMemo(
    () =>
      canManage &&
      Boolean(form.partnerCompanyId) &&
      Boolean(form.requestedCompanyName.trim()) &&
      Boolean(form.requestedOwnerEmail.trim()),
    [canManage, form.partnerCompanyId, form.requestedCompanyName, form.requestedOwnerEmail],
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const response = await fetch("/api/platform/partner-clients/provision", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify(form),
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      message?: string;
    };

    if (!response.ok || !payload.ok) {
      setMessage(payload.message ?? "Provisioning failed.");
      return;
    }

    setMessage("Client workspace provisioned and owner invite created.");
    setForm((current) => ({
      ...current,
      requestedCompanyName: "",
      requestedOwnerEmail: "",
      requestedOwnerName: "",
      externalClientReference: "",
    }));
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border bg-white p-6 shadow-sm">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
          Provision client
        </p>
        <h2 className="mt-2 text-2xl font-black text-slate-950">
          Create partner client workspace
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Creates the workspace, partner relationship, default roles, plan, and
          owner invitation in one idempotent operation.
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <label className="block text-sm font-semibold text-slate-700">
          Partner
          <select
            value={form.partnerCompanyId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                partnerCompanyId: event.target.value,
              }))
            }
            disabled={!canManage}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
          >
            {partners.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.name} ({partner.status})
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-semibold text-slate-700">
          Client company name
          <input
            value={form.requestedCompanyName}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                requestedCompanyName: event.target.value,
              }))
            }
            disabled={!canManage}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
            placeholder="Acme Retail Pvt Ltd"
          />
        </label>

        <label className="block text-sm font-semibold text-slate-700">
          Owner email
          <input
            type="email"
            value={form.requestedOwnerEmail}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                requestedOwnerEmail: event.target.value,
              }))
            }
            disabled={!canManage}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
            placeholder="owner@client.com"
          />
        </label>

        <label className="block text-sm font-semibold text-slate-700">
          Owner name
          <input
            value={form.requestedOwnerName}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                requestedOwnerName: event.target.value,
              }))
            }
            disabled={!canManage}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
            placeholder="Optional"
          />
        </label>

        <label className="block text-sm font-semibold text-slate-700">
          Plan
          <select
            value={form.requestedPlan}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                requestedPlan: event.target.value,
                requestedPlanDays: event.target.value === "FREE" ? 14 : 30,
              }))
            }
            disabled={!canManage}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
          >
            {PLAN_OPTIONS.map((plan) => (
              <option key={plan} value={plan}>
                {plan}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-semibold text-slate-700">
          Plan days
          <input
            type="number"
            min={1}
            max={3650}
            value={form.requestedPlanDays}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                requestedPlanDays: Number(event.target.value),
              }))
            }
            disabled={!canManage}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
          />
        </label>

        <label className="block text-sm font-semibold text-slate-700 lg:col-span-2">
          External client reference
          <input
            value={form.externalClientReference}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                externalClientReference: event.target.value,
              }))
            }
            disabled={!canManage}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
            placeholder="Optional CRM, partner, or contract reference"
          />
        </label>
      </div>

      {message ? (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit || isPending}
        className="mt-6 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {isPending ? "Provisioning..." : "Provision client"}
      </button>
    </form>
  );
}
