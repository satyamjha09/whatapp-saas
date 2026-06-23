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

  return (
    <form action={save} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-gray-700">Name</label>
        <input
          name="name"
          defaultValue={contact.name ?? ""}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700">Email</label>
        <input
          name="email"
          type="email"
          defaultValue={contact.email ?? ""}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700">Company</label>
        <input
          name="companyName"
          defaultValue={contact.companyName ?? ""}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700">
          External Customer ID
        </label>
        <input
          name="externalCustomerId"
          defaultValue={contact.externalCustomerId ?? ""}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700">
          Lifecycle Stage
        </label>
        <select
          name="lifecycleStage"
          defaultValue={contact.lifecycleStage}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
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
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {isSaving ? "Saving..." : "Save Profile"}
      </button>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
