"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RoleAssignmentForm({
  userId,
  currentRoleId,
  roles,
}: {
  userId: string;
  currentRoleId?: string | null;
  roles: Array<{ id: string; name: string; slug: string }>;
}) {
  const router = useRouter();
  const [roleId, setRoleId] = useState(currentRoleId ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setIsSaving(true);
    setError("");
    try {
      const response = await fetch("/api/team/role-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, roleId }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Unable to assign role");
        return;
      }
      router.refresh();
    } catch {
      setError("Unable to assign role");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select
          value={roleId}
          onChange={(event) => setRoleId(event.target.value)}
          className="rounded-lg border px-3 py-1.5 text-xs"
        >
          <option value="">Select role</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={save}
          disabled={isSaving || !roleId || roleId === currentRoleId}
          className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          {isSaving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
