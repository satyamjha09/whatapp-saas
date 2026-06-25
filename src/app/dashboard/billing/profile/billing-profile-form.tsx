"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type BillingProfile = {
  legalName: string | null;
  billingEmail: string | null;
  billingPhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  taxIdLabel: string | null;
  taxId: string | null;
  invoiceNotes: string | null;
};

export function BillingProfileForm({
  profile,
}: {
  profile: BillingProfile;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    legalName: profile.legalName ?? "",
    billingEmail: profile.billingEmail ?? "",
    billingPhone: profile.billingPhone ?? "",

    addressLine1: profile.addressLine1 ?? "",
    addressLine2: profile.addressLine2 ?? "",
    city: profile.city ?? "",
    state: profile.state ?? "",
    postalCode: profile.postalCode ?? "",
    country: profile.country ?? "",

    taxIdLabel: profile.taxIdLabel ?? "Tax ID",
    taxId: profile.taxId ?? "",

    invoiceNotes: profile.invoiceNotes ?? "",
  });

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function save() {
    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/billing/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to save billing profile.");
        return;
      }

      setMessage("Billing profile saved.");
      router.refresh();
    } catch {
      setError("Unable to save billing profile.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">
        Billing Details
      </h2>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Legal / Billing Name
          </span>
          <input
            value={form.legalName}
            onChange={(event) => update("legalName", event.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm border-gray-300 focus:border-gray-950 focus:ring-gray-950"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Billing Email
          </span>
          <input
            value={form.billingEmail}
            onChange={(event) => update("billingEmail", event.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm border-gray-300 focus:border-gray-950 focus:ring-gray-950"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Billing Phone
          </span>
          <input
            value={form.billingPhone}
            onChange={(event) => update("billingPhone", event.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm border-gray-300 focus:border-gray-950 focus:ring-gray-950"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Country
          </span>
          <input
            value={form.country}
            onChange={(event) => update("country", event.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm border-gray-300 focus:border-gray-950 focus:ring-gray-950"
          />
        </label>

        <label className="block md:col-span-2">
          <span className="text-sm font-medium text-gray-700">
            Address Line 1
          </span>
          <input
            value={form.addressLine1}
            onChange={(event) => update("addressLine1", event.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm border-gray-300 focus:border-gray-950 focus:ring-gray-950"
          />
        </label>

        <label className="block md:col-span-2">
          <span className="text-sm font-medium text-gray-700">
            Address Line 2
          </span>
          <input
            value={form.addressLine2}
            onChange={(event) => update("addressLine2", event.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm border-gray-300 focus:border-gray-950 focus:ring-gray-950"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">City</span>
          <input
            value={form.city}
            onChange={(event) => update("city", event.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm border-gray-300 focus:border-gray-950 focus:ring-gray-950"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">State</span>
          <input
            value={form.state}
            onChange={(event) => update("state", event.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm border-gray-300 focus:border-gray-950 focus:ring-gray-950"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Postal Code
          </span>
          <input
            value={form.postalCode}
            onChange={(event) => update("postalCode", event.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm border-gray-300 focus:border-gray-950 focus:ring-gray-950"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Tax ID Label
          </span>
          <input
            value={form.taxIdLabel}
            onChange={(event) => update("taxIdLabel", event.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm border-gray-300 focus:border-gray-950 focus:ring-gray-950"
            placeholder="GSTIN / VAT / Tax ID"
          />
        </label>

        <label className="block md:col-span-2">
          <span className="text-sm font-medium text-gray-700">Tax ID</span>
          <input
            value={form.taxId}
            onChange={(event) => update("taxId", event.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm border-gray-300 focus:border-gray-950 focus:ring-gray-950"
          />
        </label>

        <label className="block md:col-span-2">
          <span className="text-sm font-medium text-gray-700">
            Invoice Notes
          </span>
          <textarea
            value={form.invoiceNotes}
            onChange={(event) => update("invoiceNotes", event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm border-gray-300 focus:border-gray-950 focus:ring-gray-950"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={isSaving}
        className="mt-5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-950 focus:ring-offset-2 disabled:opacity-60 transition"
      >
        {isSaving ? "Saving..." : "Save Billing Profile"}
      </button>

      {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}
