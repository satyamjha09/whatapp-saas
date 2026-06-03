"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type MemberRole = "OWNER" | "ADMIN" | "MEMBER";

type MemberRoleSelectProps = {
  companyUserId: string;
  currentRole: MemberRole;
  disabled: boolean;
};

type UpdateRoleResponse = {
  message: string;
};

export default function MemberRoleSelect({
  companyUserId,
  currentRole,
  disabled,
}: MemberRoleSelectProps) {
  const router = useRouter();

  const [role, setRole] = useState<MemberRole>(currentRole);
  const [error, setError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  async function updateRole(nextRole: MemberRole) {
    setRole(nextRole);
    setError("");
    setIsUpdating(true);

    try {
      const response = await fetch(`/api/team/${companyUserId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: nextRole,
        }),
      });

      const data: UpdateRoleResponse = await response.json();

      if (!response.ok) {
        setRole(currentRole);
        setError(data.message);
        return;
      }

      router.refresh();
    } catch {
      setRole(currentRole);
      setError("Unable to update role. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div>
      <select
        value={role}
        disabled={disabled || isUpdating}
        onChange={(event) => updateRole(event.target.value as MemberRole)}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="OWNER">OWNER</option>
        <option value="ADMIN">ADMIN</option>
        <option value="MEMBER">MEMBER</option>
      </select>

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
