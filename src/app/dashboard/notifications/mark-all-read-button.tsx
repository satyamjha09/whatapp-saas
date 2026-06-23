"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type MarkAllReadResponse = { message: string };

export default function MarkAllReadButton() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function markAllRead() {
    setError("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
      });
      const data = (await response.json()) as MarkAllReadResponse;

      if (!response.ok) {
        setError(data.message);
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to mark notifications as read.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={markAllRead}
        disabled={isSaving}
        className="rounded-lg bg-[#0052CC] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#003D99] disabled:opacity-60"
      >
        {isSaving ? "Saving..." : "Mark All Read"}
      </button>

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
