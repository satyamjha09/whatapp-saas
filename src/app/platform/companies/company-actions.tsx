"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function actionLabel(action: string) {
  if (action === "reactivate") return "Reactivate";
  return `${action.charAt(0).toUpperCase()}${action.slice(1)}`;
}

export function PlatformCompanyActions({
  companyId,
  status,
}: {
  companyId: string;
  status: string;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState("");
  const [error, setError] = useState("");

  async function runAction(action: "activate" | "suspend" | "reactivate" | "disable") {
    setError("");
    const needsReason = action === "suspend" || action === "disable";
    const reason = needsReason
      ? window.prompt(`Reason to ${action} this company?`)?.trim()
      : "";

    if (needsReason && !reason) return;

    setIsSaving(action);

    try {
      const response = await fetch(`/api/platform/companies/${companyId}/${action}`, {
        method: "POST",
        headers: needsReason
          ? {
              "Content-Type": "application/json",
            }
          : undefined,
        body: needsReason ? JSON.stringify({ reason }) : undefined,
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(data.message ?? `Unable to ${action} company.`);
        return;
      }

      router.refresh();
    } finally {
      setIsSaving("");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status !== "ACTIVE" ? (
          <button
            type="button"
            onClick={() =>
              runAction(status === "SUSPENDED" ? "reactivate" : "activate")
            }
            disabled={Boolean(isSaving)}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {isSaving
              ? "Saving..."
              : actionLabel(status === "SUSPENDED" ? "reactivate" : "activate")}
          </button>
        ) : null}

        {status !== "SUSPENDED" && status !== "DISABLED" ? (
          <button
            type="button"
            onClick={() => runAction("suspend")}
            disabled={Boolean(isSaving)}
            className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 disabled:opacity-50"
          >
            Suspend
          </button>
        ) : null}

        {status !== "DISABLED" ? (
          <button
            type="button"
            onClick={() => runAction("disable")}
            disabled={Boolean(isSaving)}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50"
          >
            Disable
          </button>
        ) : null}
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

export function PlatformCompanyNoteForm({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"INTERNAL" | "SUPPORT" | "FINANCE">(
    "INTERNAL",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function addNote() {
    setError("");
    setIsSaving(true);

    try {
      const response = await fetch(`/api/platform/companies/${companyId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          body,
          visibility,
        }),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(data.message ?? "Unable to add note.");
        return;
      }

      setTitle("");
      setBody("");
      setVisibility("INTERNAL");
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Add Platform Note</h2>

      <div className="mt-4 space-y-3">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Note title"
          className="w-full rounded-xl border px-3 py-2 text-sm"
        />

        <select
          value={visibility}
          onChange={(event) =>
            setVisibility(event.target.value as "INTERNAL" | "SUPPORT" | "FINANCE")
          }
          className="w-full rounded-xl border px-3 py-2 text-sm"
        >
          <option value="INTERNAL">Internal</option>
          <option value="SUPPORT">Support</option>
          <option value="FINANCE">Finance</option>
        </select>

        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write the internal note..."
          rows={5}
          className="w-full rounded-xl border px-3 py-2 text-sm"
        />
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <button
        type="button"
        onClick={addNote}
        disabled={isSaving || !title.trim() || !body.trim()}
        className="mt-4 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isSaving ? "Saving..." : "Add Note"}
      </button>
    </section>
  );
}
