"use client";

import { RefreshCcw, ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const PERMISSIONS = [
  ["CLIENT_VIEW", "View client"],
  ["CLIENT_SUPPORT", "Support"],
  ["CLIENT_WHATSAPP_MANAGE", "WhatsApp"],
  ["CLIENT_CAMPAIGN_MANAGE", "Campaigns"],
  ["CLIENT_BILLING_VIEW", "Billing view"],
] as const;

type PartnerUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

type GrantClientAccessFormProps = {
  canManage: boolean;
  clientCompanyId: string;
  partnerCompanyId: string;
  users: PartnerUser[];
};

export function GrantClientAccessForm({
  canManage,
  clientCompanyId,
  partnerCompanyId,
  users,
}: GrantClientAccessFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const formData = new FormData(event.currentTarget);
    const permissions = formData.getAll("permissions").map(String);
    const payload = {
      partnerCompanyId,
      clientCompanyId,
      userId: String(formData.get("userId") || ""),
      permissions,
      expiresAt: formData.get("expiresAt")
        ? new Date(String(formData.get("expiresAt"))).toISOString()
        : null,
    };

    try {
      const response = await fetch("/api/platform/partner-clients/access-grants", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to grant client access.");
      }

      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to grant access.");
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) {
    return (
      <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
        Partner management permission is required to create access grants.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-3 rounded-xl border bg-white p-3">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
        <ShieldCheck className="h-3.5 w-3.5" />
        Grant client access
      </div>
      <select
        name="userId"
        required
        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
      >
        <option value="">Select partner user</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name || user.email} ({user.role})
          </option>
        ))}
      </select>
      <div className="grid gap-2 sm:grid-cols-2">
        {PERMISSIONS.map(([value, label]) => (
          <label
            key={value}
            className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
          >
            <input
              type="checkbox"
              name="permissions"
              value={value}
              defaultChecked={value === "CLIENT_VIEW" || value === "CLIENT_SUPPORT"}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600"
            />
            {label}
          </label>
        ))}
      </div>
      <label className="block text-xs font-semibold text-slate-600">
        Optional expiry
        <input
          name="expiresAt"
          type="datetime-local"
          className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
        />
      </label>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={saving}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCcw className="h-4 w-4" />
        {saving ? "Saving..." : "Save access"}
      </button>
    </form>
  );
}

export function RevokeClientAccessButton({ grantId }: { grantId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function revoke() {
    if (!confirm("Revoke this partner client access grant?")) return;

    setBusy(true);

    try {
      await fetch("/api/platform/partner-clients/access-grants", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ grantId }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={revoke}
      disabled={busy}
      className="inline-flex items-center gap-1 rounded-lg border border-red-100 bg-red-50 px-2 py-1 text-xs font-bold text-red-700 disabled:opacity-60"
    >
      <Trash2 className="h-3.5 w-3.5" />
      Revoke
    </button>
  );
}
