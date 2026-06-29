"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Member = {
  id: string;
  userId: string;
  role: string;
  user: {
    name: string | null;
    email: string;
  };
};

type ConversationAssigneeSelectProps = {
  contactId: string;
  currentAssignedToUserId: string | null;
  currentUserId: string;
  members: Member[];
};

type UpdateAssigneeResponse = {
  message: string;
  errors?: {
    assignedToUserId?: string[];
  };
};

function memberLabel(member: Member) {
  return `${member.user.name ?? member.user.email} - ${member.role}`;
}

export default function ConversationAssigneeSelect({
  contactId,
  currentAssignedToUserId,
  currentUserId,
  members,
}: ConversationAssigneeSelectProps) {
  const router = useRouter();

  const [value, setValue] = useState(currentAssignedToUserId ?? "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  async function updateAssignee(nextAssignedToUserId: string | null) {
    setValue(nextAssignedToUserId ?? "");
    setError("");
    setSuccess("");
    setIsUpdating(true);

    try {
      const response = await fetch(
        `/api/inbox/conversations/${contactId}/assignee`,
        {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignedToUserId: nextAssignedToUserId,
        }),
        },
      );

      const data = (await response.json()) as UpdateAssigneeResponse;

      if (!response.ok) {
        setValue(currentAssignedToUserId ?? "");
        setError(
          data.errors?.assignedToUserId?.[0] ??
            data.message ??
            "Unable to update assignee.",
        );
        return;
      }

      const member = members.find(
        (item) => item.userId === nextAssignedToUserId,
      );
      setSuccess(
        member
          ? `Assigned to ${member.user.name ?? member.user.email}.`
          : "Conversation unassigned.",
      );
      router.refresh();
    } catch {
      setValue(currentAssignedToUserId ?? "");
      setError("Unable to update assignee. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  }

  const isAssignedToMe = value === currentUserId;

  return (
    <div>
      <label
        htmlFor="conversationAssignee"
        className="mb-2 block text-xs font-medium text-gray-500"
      >
        Assigned to
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <select
          id="conversationAssignee"
          value={value}
          disabled={isUpdating}
          onChange={(event) => updateAssignee(event.target.value || null)}
          className="min-w-56 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 disabled:opacity-60"
        >
          <option value="">Unassigned</option>
          {members.map((member) => (
            <option key={member.id} value={member.userId}>
              {memberLabel(member)}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => updateAssignee(currentUserId)}
          disabled={isUpdating || isAssignedToMe}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Assign to me
        </button>
      </div>

      {success ? (
        <p className="mt-2 rounded-lg bg-green-50 p-2 text-xs text-green-700">
          {success}
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
