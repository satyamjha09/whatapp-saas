"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type NotificationActionsProps = {
  notificationId: string;
  isUnread: boolean;
};

type ActionResponse = { message: string };

export default function NotificationActions({
  notificationId,
  isUnread,
}: NotificationActionsProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function runAction(action: "read" | "archive") {
    setError("");
    setIsSaving(true);

    try {
      const response = await fetch(
        `/api/notifications/${notificationId}/${action}`,
        { method: "POST" },
      );
      const data = (await response.json()) as ActionResponse;

      if (!response.ok) {
        setError(data.message);
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to update notification.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isUnread ? (
        <button
          type="button"
          onClick={() => runAction("read")}
          disabled={isSaving}
          className="rounded-lg border border-[#BFE9D0] px-3 py-2 text-xs font-medium text-[#526173] transition hover:bg-[#E7F8EF] disabled:opacity-60"
        >
          Mark Read
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => runAction("archive")}
        disabled={isSaving}
        className="rounded-lg border border-[#BFE9D0] px-3 py-2 text-xs font-medium text-[#526173] transition hover:bg-[#E7F8EF] disabled:opacity-60"
      >
        Archive
      </button>

      {error ? <p className="w-full text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
