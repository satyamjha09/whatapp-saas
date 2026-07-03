"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  actionButtonClass,
  fieldClass,
  labelClass,
} from "@/app/dashboard/dashboard-ui";

export function CreateContactListModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!open) return null;

  async function save() {
    if (!name.trim()) {
      setError("List name is required.");
      return;
    }

    setError("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/contacts/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to create list.");
        return;
      }

      setName("");
      setDescription("");
      onClose();
      router.push(`/dashboard/contacts/lists/${data.list.id}`);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#BFE9D0] bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-[#081B3A]">Create contact list</h2>
        <p className="mt-1 text-sm text-[#526173]">
          A static list of contacts you can broadcast to later.
        </p>

        <div className="mt-4 grid gap-4">
          <div>
            <label className={labelClass} htmlFor="list-name">
              Name <span className="text-rose-600">*</span>
            </label>
            <input
              id="list-name"
              className={fieldClass}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="June Imported Leads"
              maxLength={100}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="list-description">
              Description
            </label>
            <input
              id="list-description"
              className={fieldClass}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional"
              maxLength={500}
            />
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              className={actionButtonClass("primary")}
              onClick={save}
              disabled={isSaving}
            >
              {isSaving ? "Creating..." : "Create list"}
            </button>
            <button
              type="button"
              className={actionButtonClass("secondary")}
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
