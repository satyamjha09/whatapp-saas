"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateCampaignConversionButton() {
  const router = useRouter();
  const [campaignId, setCampaignId] = useState("");
  const [contactId, setContactId] = useState("");
  const [type, setType] = useState("DEMO_BOOKED");
  const [valuePaise, setValuePaise] = useState("");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function create() {
    if (!campaignId.trim()) return;

    setIsSaving(true);

    try {
      await fetch("/api/campaign-replies/conversions", {
        body: JSON.stringify({
          campaignId: campaignId.trim(),
          contactId: contactId.trim() || null,
          note: note.trim() || null,
          type,
          valuePaise: valuePaise ? Number(valuePaise) : null,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      setCampaignId("");
      setContactId("");
      setValuePaise("");
      setNote("");
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">
        Add Conversion Event
      </h2>
      <div className="mt-4 grid gap-3 md:grid-cols-5">
        <input
          value={campaignId}
          onChange={(event) => setCampaignId(event.target.value)}
          placeholder="Campaign ID"
          className="rounded-xl border px-3 py-2 text-sm"
        />
        <input
          value={contactId}
          onChange={(event) => setContactId(event.target.value)}
          placeholder="Contact ID optional"
          className="rounded-xl border px-3 py-2 text-sm"
        />
        <select
          value={type}
          onChange={(event) => setType(event.target.value)}
          className="rounded-xl border px-3 py-2 text-sm"
        >
          <option value="DEMO_BOOKED">DEMO_BOOKED</option>
          <option value="MEETING_DONE">MEETING_DONE</option>
          <option value="PAYMENT_RECEIVED">PAYMENT_RECEIVED</option>
          <option value="LEAD_WON">LEAD_WON</option>
          <option value="LEAD_LOST">LEAD_LOST</option>
        </select>
        <input
          value={valuePaise}
          onChange={(event) => setValuePaise(event.target.value)}
          placeholder="Value paise"
          className="rounded-xl border px-3 py-2 text-sm"
        />
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Note"
          className="rounded-xl border px-3 py-2 text-sm"
        />
      </div>
      <button
        type="button"
        onClick={create}
        disabled={isSaving || !campaignId.trim()}
        className="mt-4 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isSaving ? "Saving..." : "Add Conversion"}
      </button>
    </section>
  );
}

export function FollowUpTaskActions({
  status,
  taskId,
}: {
  status: string;
  taskId: string;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  async function update(nextStatus: "COMPLETED" | "IGNORED") {
    const ignoreReason =
      nextStatus === "IGNORED" ? window.prompt("Ignore reason:") : null;

    if (nextStatus === "IGNORED" && !ignoreReason) return;

    setIsSaving(true);

    try {
      await fetch(`/api/campaign-replies/tasks/${taskId}/status`, {
        body: JSON.stringify({
          ignoreReason,
          status: nextStatus,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => void update("COMPLETED")}
        disabled={isSaving || status !== "OPEN"}
        className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
      >
        Complete
      </button>
      <button
        type="button"
        onClick={() => void update("IGNORED")}
        disabled={isSaving || status !== "OPEN"}
        className="rounded-lg border px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-50"
      >
        Ignore
      </button>
    </div>
  );
}
