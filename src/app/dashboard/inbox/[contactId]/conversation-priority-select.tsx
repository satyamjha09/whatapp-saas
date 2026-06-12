"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type InboxPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

type ConversationPrioritySelectProps = {
  contactId: string;
  currentPriority: InboxPriority;
};

type UpdatePriorityResponse = {
  message: string;
};

const priorities: InboxPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

export default function ConversationPrioritySelect({
  contactId,
  currentPriority,
}: ConversationPrioritySelectProps) {
  const router = useRouter();

  const [value, setValue] = useState<InboxPriority>(currentPriority);
  const [error, setError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  async function updatePriority(nextPriority: InboxPriority) {
    setValue(nextPriority);
    setError("");
    setIsUpdating(true);

    try {
      const response = await fetch(`/api/inbox/${contactId}/priority`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          priority: nextPriority,
        }),
      });

      const data: UpdatePriorityResponse = await response.json();

      if (!response.ok) {
        setValue(currentPriority);
        setError(data.message);
        return;
      }

      router.refresh();
    } catch {
      setValue(currentPriority);
      setError("Unable to update priority. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div>
      <label
        htmlFor="conversationPriority"
        className="mb-2 block text-xs font-medium text-gray-500"
      >
        Priority
      </label>

      <select
        id="conversationPriority"
        value={value}
        disabled={isUpdating}
        onChange={(event) =>
          updatePriority(event.target.value as InboxPriority)
        }
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 disabled:opacity-60"
      >
        {priorities.map((priority) => (
          <option key={priority} value={priority}>
            {priority}
          </option>
        ))}
      </select>

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
