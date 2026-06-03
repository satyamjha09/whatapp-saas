"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type InboxStatus = "OPEN" | "CLOSED";

type ConversationStatusButtonProps = {
  contactId: string;
  currentStatus: InboxStatus;
};

type UpdateConversationStatusResponse = {
  message: string;
};

export default function ConversationStatusButton({
  contactId,
  currentStatus,
}: ConversationStatusButtonProps) {
  const router = useRouter();

  const [error, setError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const nextStatus = currentStatus === "OPEN" ? "CLOSED" : "OPEN";

  async function updateStatus() {
    setError("");
    setIsUpdating(true);

    try {
      const response = await fetch(`/api/inbox/${contactId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: nextStatus,
        }),
      });

      const data: UpdateConversationStatusResponse = await response.json();

      if (!response.ok) {
        setError(data.message);
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to update conversation status. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={updateStatus}
        disabled={isUpdating}
        className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isUpdating
          ? "Updating..."
          : currentStatus === "OPEN"
            ? "Close Conversation"
            : "Reopen Conversation"}
      </button>

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
