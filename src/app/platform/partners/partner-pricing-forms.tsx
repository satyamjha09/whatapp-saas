"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";

type PartnerOption = {
  id: string;
  name: string;
  status: string;
};

type PriceBookOption = {
  id: string;
  partnerCompanyId: string;
  name: string;
  currency: string;
  active: boolean;
  items: PriceBookItemOption[];
};

type PriceBookItemOption = {
  id: string;
  platformPlanCode: string;
  minimumRetailPaise: number;
  suggestedRetailPaise: number | null;
  active: boolean;
};

type ClientOption = {
  id: string;
  name: string;
  partnerCompanyId: string;
};

const PLAN_OPTIONS = ["FREE", "STARTER", "GROWTH", "BUSINESS", "ENTERPRISE"];

function paiseToRupees(value: number) {
  return Math.round(value / 100).toString();
}

function rupeesToPaise(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.round(amount * 100);
}

function FormMessage({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
      {message}
    </p>
  );
}

export function PartnerPriceBookForm({
  canManage,
  partners,
}: {
  canManage: boolean;
  partners: PartnerOption[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    partnerCompanyId: partners[0]?.id ?? "",
    name: "Default Partner Price Book",
    currency: "INR",
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Saving price book...");

    const response = await fetch("/api/platform/partner-pricing/price-books", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...form,
        active: true,
      }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(payload.message ?? "Price book could not be saved.");
      return;
    }

    setMessage("Price book saved. Refreshing...");
    window.location.reload();
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
        Price book
      </p>
      <h3 className="mt-1 text-xl font-black text-slate-950">
        Create partner price book
      </h3>
      <div className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Partner
          <select
            className="rounded-xl border px-3 py-2"
            disabled={!canManage}
            value={form.partnerCompanyId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                partnerCompanyId: event.target.value,
              }))
            }
          >
            {partners.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.name} ({partner.status})
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Name
          <input
            className="rounded-xl border px-3 py-2"
            disabled={!canManage}
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Currency
          <input
            className="rounded-xl border px-3 py-2 uppercase"
            disabled={!canManage}
            maxLength={3}
            value={form.currency}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                currency: event.target.value.toUpperCase(),
              }))
            }
          />
        </label>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <FormMessage message={message} />
        <button
          type="submit"
          disabled={!canManage || !form.partnerCompanyId}
          className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Save price book
        </button>
      </div>
    </form>
  );
}

export function PartnerPriceBookItemForm({
  isSuperAdmin,
  priceBooks,
}: {
  isSuperAdmin: boolean;
  priceBooks: PriceBookOption[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    priceBookId: priceBooks[0]?.id ?? "",
    platformPlanCode: "STARTER",
    wholesaleMonthlyRupees: "499",
    minimumRetailRupees: "699",
    suggestedRetailRupees: "999",
    includedMessages: "1000",
    extraMessageRupees: "1",
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Saving plan pricing...");

    const response = await fetch(
      `/api/platform/partner-pricing/price-books/${form.priceBookId}/items`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          platformPlanCode: form.platformPlanCode,
          wholesaleMonthlyPaise: rupeesToPaise(form.wholesaleMonthlyRupees),
          minimumRetailPaise: rupeesToPaise(form.minimumRetailRupees),
          suggestedRetailPaise: form.suggestedRetailRupees
            ? rupeesToPaise(form.suggestedRetailRupees)
            : null,
          includedMessages: form.includedMessages
            ? Number(form.includedMessages)
            : null,
          extraMessagePaise: form.extraMessageRupees
            ? rupeesToPaise(form.extraMessageRupees)
            : null,
          active: true,
        }),
      },
    );
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(payload.message ?? "Plan pricing could not be saved.");
      return;
    }

    setMessage("Plan pricing saved. Refreshing...");
    window.location.reload();
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-700">
        Wholesale
      </p>
      <h3 className="mt-1 text-xl font-black text-slate-950">
        Add plan pricing
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        Only super admins can update wholesale and retail floor values.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold text-slate-700 md:col-span-2">
          Price book
          <select
            className="rounded-xl border px-3 py-2"
            disabled={!isSuperAdmin}
            value={form.priceBookId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                priceBookId: event.target.value,
              }))
            }
          >
            {priceBooks.map((book) => (
              <option key={book.id} value={book.id}>
                {book.name} ({book.currency})
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Plan
          <select
            className="rounded-xl border px-3 py-2"
            disabled={!isSuperAdmin}
            value={form.platformPlanCode}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                platformPlanCode: event.target.value,
              }))
            }
          >
            {PLAN_OPTIONS.map((plan) => (
              <option key={plan} value={plan}>
                {plan}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Wholesale monthly (INR)
          <input
            className="rounded-xl border px-3 py-2"
            disabled={!isSuperAdmin}
            value={form.wholesaleMonthlyRupees}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                wholesaleMonthlyRupees: event.target.value,
              }))
            }
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Minimum retail floor (INR)
          <input
            className="rounded-xl border px-3 py-2"
            disabled={!isSuperAdmin}
            value={form.minimumRetailRupees}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                minimumRetailRupees: event.target.value,
              }))
            }
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Suggested retail (INR)
          <input
            className="rounded-xl border px-3 py-2"
            disabled={!isSuperAdmin}
            value={form.suggestedRetailRupees}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                suggestedRetailRupees: event.target.value,
              }))
            }
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Included messages
          <input
            className="rounded-xl border px-3 py-2"
            disabled={!isSuperAdmin}
            value={form.includedMessages}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                includedMessages: event.target.value,
              }))
            }
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Extra message (INR)
          <input
            className="rounded-xl border px-3 py-2"
            disabled={!isSuperAdmin}
            value={form.extraMessageRupees}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                extraMessageRupees: event.target.value,
              }))
            }
          />
        </label>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <FormMessage message={message} />
        <button
          type="submit"
          disabled={!isSuperAdmin || !form.priceBookId}
          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Save plan pricing
        </button>
      </div>
    </form>
  );
}

export function PartnerClientSubscriptionForm({
  canAssign,
  clients,
  priceBooks,
}: {
  canAssign: boolean;
  clients: ClientOption[];
  priceBooks: PriceBookOption[];
}) {
  const activeItems = useMemo(
    () =>
      priceBooks.flatMap((book) =>
        book.items
          .filter((item) => item.active && book.active)
          .map((item) => ({
            ...item,
            priceBookId: book.id,
            priceBookName: book.name,
            partnerCompanyId: book.partnerCompanyId,
            currency: book.currency,
          })),
      ),
    [priceBooks],
  );
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    clientCompanyId: clients[0]?.id ?? "",
    priceBookItemId: activeItems[0]?.id ?? "",
    retailRupees: activeItems[0]?.suggestedRetailPaise
      ? paiseToRupees(activeItems[0].suggestedRetailPaise)
      : activeItems[0]?.minimumRetailPaise
        ? paiseToRupees(activeItems[0].minimumRetailPaise)
        : "",
    billingDays: "30",
    status: "ACTIVE",
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Assigning client subscription...");

    const response = await fetch("/api/platform/partner-pricing/subscriptions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        clientCompanyId: form.clientCompanyId,
        priceBookItemId: form.priceBookItemId,
        retailAmountPaise: form.retailRupees
          ? rupeesToPaise(form.retailRupees)
          : undefined,
        billingDays: Number(form.billingDays || 30),
        status: form.status,
      }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(payload.message ?? "Subscription could not be assigned.");
      return;
    }

    setMessage("Subscription assigned. Refreshing...");
    window.location.reload();
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
        Client subscription
      </p>
      <h3 className="mt-1 text-xl font-black text-slate-950">
        Assign client plan snapshot
      </h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Client
          <select
            className="rounded-xl border px-3 py-2"
            disabled={!canAssign}
            value={form.clientCompanyId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                clientCompanyId: event.target.value,
              }))
            }
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Price item
          <select
            className="rounded-xl border px-3 py-2"
            disabled={!canAssign}
            value={form.priceBookItemId}
            onChange={(event) => {
              const item = activeItems.find(
                (current) => current.id === event.target.value,
              );
              setForm((current) => ({
                ...current,
                priceBookItemId: event.target.value,
                retailRupees: item?.suggestedRetailPaise
                  ? paiseToRupees(item.suggestedRetailPaise)
                  : item?.minimumRetailPaise
                    ? paiseToRupees(item.minimumRetailPaise)
                    : current.retailRupees,
              }));
            }}
          >
            {activeItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.priceBookName} - {item.platformPlanCode} floor{" "}
                {item.currency} {paiseToRupees(item.minimumRetailPaise)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Retail amount (INR)
          <input
            className="rounded-xl border px-3 py-2"
            disabled={!canAssign}
            value={form.retailRupees}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                retailRupees: event.target.value,
              }))
            }
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Billing days
          <input
            className="rounded-xl border px-3 py-2"
            disabled={!canAssign}
            value={form.billingDays}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                billingDays: event.target.value,
              }))
            }
          />
        </label>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <FormMessage message={message} />
        <button
          type="submit"
          disabled={!canAssign || !form.clientCompanyId || !form.priceBookItemId}
          className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Assign subscription
        </button>
      </div>
    </form>
  );
}
