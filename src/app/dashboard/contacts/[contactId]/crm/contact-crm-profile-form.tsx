"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ContactCrmProfileForm({
  contact,
}: {
  contact: {
    id: string;
    name: string | null;
    email: string | null;
    companyName: string | null;
    externalCustomerId: string | null;
    lifecycleStage: string;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function save(formData: FormData) {
    setIsSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/contacts/${contact.id}/crm`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: String(formData.get("name") ?? ""),
          email: String(formData.get("email") ?? "") || null,
          companyName: String(formData.get("companyName") ?? "") || null,
          externalCustomerId:
            String(formData.get("externalCustomerId") ?? "") || null,
          lifecycleStage: String(formData.get("lifecycleStage") ?? "LEAD"),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to save profile");
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to save profile");
    } finally {
      setIsSaving(false);
    }
  }

  const fieldClass =
    "mt-2 w-full rounded-2xl border border-[#BFE9D0] bg-white px-4 py-3 text-sm font-semibold text-[#081B3A] outline-none transition placeholder:text-[#94A3B8] focus:border-[#128C7E] focus:ring-4 focus:ring-[#128C7E]/10";
  const labelClass =
    "text-xs font-black uppercase tracking-[0.12em] text-[#526173]";

  return (
    <form action={save} className="space-y-5">
      <div>
        <label className={labelClass}>Name</label>
        <input
          name="name"
          defaultValue={contact.name ?? ""}
          className={fieldClass}
          placeholder="Customer display name"
        />
      </div>

      <div>
        <label className={labelClass}>Email</label>
        <input
          name="email"
          type="email"
          defaultValue={contact.email ?? ""}
          className={fieldClass}
          placeholder="customer@example.com"
        />
      </div>

      <div>
        <label className={labelClass}>Company</label>
        <input
          name="companyName"
          defaultValue={contact.companyName ?? ""}
          className={fieldClass}
          placeholder="Business or organization"
        />
      </div>

      <div>
        <label className={labelClass}>
          External Customer ID
        </label>
        <input
          name="externalCustomerId"
          defaultValue={contact.externalCustomerId ?? ""}
          className={fieldClass}
          placeholder="Tally, ERP, or CRM reference"
        />
        <p className="mt-2 text-xs font-semibold leading-5 text-[#526173]">
          Optional. Use this to match Tally ledgers, imported customers, or external CRM records.
        </p>
      </div>

      <div>
        <label className={labelClass}>
          Lifecycle Stage
        </label>
        <select
          name="lifecycleStage"
          defaultValue={contact.lifecycleStage}
          className={fieldClass}
        >
          <option value="LEAD">Lead</option>
          <option value="CUSTOMER">Customer</option>
          <option value="VIP">VIP</option>
          <option value="AT_RISK">At Risk</option>
          <option value="CHURNED">Churned</option>
        </select>
      </div>

      <button
        disabled={isSaving}
        className="inline-flex items-center justify-center rounded-2xl bg-[#128C7E] px-5 py-3 text-sm font-black text-white shadow-[0_16px_34px_rgba(18,140,126,0.22)] transition hover:-translate-y-0.5 hover:bg-[#0F766E] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? "Saving..." : "Save Profile"}
      </button>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}
