"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { PlatformRole } from "@/generated/prisma/client";

const ROLE_OPTIONS: Array<{ label: string; value: PlatformRole; help: string }> = [
  {
    label: "No platform access",
    value: "NONE",
    help: "Workspace-only user.",
  },
  {
    label: "Support",
    value: "SUPPORT",
    help: "Read companies and support context.",
  },
  {
    label: "Finance",
    value: "FINANCE",
    help: "Billing, usage, refunds, commissions.",
  },
  {
    label: "Admin",
    value: "ADMIN",
    help: "Company and partner operations.",
  },
  {
    label: "Super admin",
    value: "SUPER_ADMIN",
    help: "All platform permissions and dangerous actions.",
  },
];

export function PlatformUserActions({
  currentUserId,
  isCurrentUser,
  platformAccessEnabled,
  platformRole,
  superAdminCount,
  userEmail,
  userId,
}: {
  currentUserId: string;
  isCurrentUser: boolean;
  platformAccessEnabled: boolean;
  platformRole: PlatformRole;
  superAdminCount: number;
  userEmail: string;
  userId: string;
}) {
  const router = useRouter();
  const [role, setRole] = useState<PlatformRole>(platformRole);
  const [enabled, setEnabled] = useState(platformAccessEnabled);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const isDirty = role !== platformRole || enabled !== platformAccessEnabled;
  const removesLastSuperAdmin =
    platformAccessEnabled &&
    platformRole === "SUPER_ADMIN" &&
    superAdminCount <= 1 &&
    (!enabled || role !== "SUPER_ADMIN");
  const selectedRole = useMemo(
    () => ROLE_OPTIONS.find((item) => item.value === role) ?? ROLE_OPTIONS[0],
    [role],
  );

  async function save() {
    setError("");

    if (removesLastSuperAdmin) {
      setError("At least one platform super admin must remain.");
      return;
    }

    if (
      isCurrentUser &&
      platformRole === "SUPER_ADMIN" &&
      (!enabled || role !== "SUPER_ADMIN") &&
      !window.confirm(
        "You are changing your own super admin access. Continue only if another super admin exists.",
      )
    ) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(
        `/api/platform/users/${encodeURIComponent(userId)}/platform-access`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            platformAccessEnabled: enabled && role !== "NONE",
            platformRole: enabled ? role : "NONE",
          }),
        },
      );
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(data.message ?? `Unable to update ${userEmail}.`);
        return;
      }

      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-w-[280px] space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => {
              const nextEnabled = event.target.checked;
              setEnabled(nextEnabled);
              if (!nextEnabled) {
                setRole("NONE");
              } else if (role === "NONE") {
                setRole("SUPPORT");
              }
            }}
            className="h-4 w-4 accent-emerald-600"
          />
          Platform access
        </label>

        {isCurrentUser ? (
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
            You
          </span>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <div>
          <select
            value={role}
            onChange={(event) => {
              const nextRole = event.target.value as PlatformRole;
              setRole(nextRole);
              setEnabled(nextRole !== "NONE");
            }}
            className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">{selectedRole.help}</p>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={!isDirty || isSaving || removesLastSuperAdmin}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>

      {removesLastSuperAdmin ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          You cannot remove the last super admin.
        </p>
      ) : null}

      {currentUserId === userId && role === "SUPER_ADMIN" ? (
        <p className="text-xs text-slate-500">
          Changes apply after refresh. Keep one backup super admin for safety.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
