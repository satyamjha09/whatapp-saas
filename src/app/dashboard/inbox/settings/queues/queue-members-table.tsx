"use client";

import { useState, useTransition } from "react";

type UserOption = {
  id: string;
  name: string | null;
  email: string;
};

type QueueMember = {
  userId: string;
  role: string;
  acceptingNew: boolean;
  maxOpenOverride: number | null;
  user: UserOption & { imageUrl?: string | null };
};

type QueueMembersTableProps = {
  queueId: string;
  members: QueueMember[];
  users: UserOption[];
};

export default function QueueMembersTable({
  queueId,
  members,
  users,
}: QueueMembersTableProps) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function addMember(formData: FormData) {
    setError("");
    const payload = {
      userId: String(formData.get("userId") ?? ""),
      role: String(formData.get("role") ?? "AGENT"),
      acceptingNew: true,
      sortOrder: 0,
    };

    startTransition(async () => {
      const response = await fetch(`/api/inbox/queues/${queueId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setError(data?.message ?? "Unable to add member");
        return;
      }

      window.location.reload();
    });
  }

  function removeMember(userId: string) {
    setError("");
    startTransition(async () => {
      const response = await fetch(
        `/api/inbox/queues/${queueId}/members?userId=${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setError(data?.message ?? "Unable to remove member");
        return;
      }

      window.location.reload();
    });
  }

  return (
    <div className="mt-4 border-t border-[#E1F5E9] pt-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
        <form action={addMember} className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <select
            name="userId"
            className="rounded-xl border border-[#BFE9D0] px-3 py-2 text-sm font-semibold text-[#081B3A]"
            defaultValue=""
          >
            <option value="" disabled>
              Add team member
            </option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name ?? user.email}
              </option>
            ))}
          </select>
          <select
            name="role"
            className="rounded-xl border border-[#BFE9D0] px-3 py-2 text-sm font-semibold text-[#081B3A]"
          >
            <option value="AGENT">Agent</option>
            <option value="SUPERVISOR">Supervisor</option>
          </select>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-[#128C7E] px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            Add
          </button>
        </form>
      </div>

      {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}

      <div className="mt-4 overflow-hidden rounded-xl border border-[#E1F5E9]">
        {members.length === 0 ? (
          <p className="px-4 py-5 text-sm text-[#526173]">No agents in this queue yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F7FFFA] text-xs uppercase tracking-[0.08em] text-[#128C7E]">
              <tr>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Accepting</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1F5E9]">
              {members.map((member) => (
                <tr key={member.userId}>
                  <td className="px-4 py-3 font-semibold text-[#081B3A]">
                    {member.user.name ?? member.user.email}
                    <span className="block text-xs font-medium text-[#526173]">
                      {member.user.email}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#526173]">{member.role}</td>
                  <td className="px-4 py-3 text-[#526173]">
                    {member.acceptingNew ? "Yes" : "No"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => removeMember(member.userId)}
                      disabled={isPending}
                      className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600 disabled:opacity-60"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
