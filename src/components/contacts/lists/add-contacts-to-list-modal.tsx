"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { actionButtonClass, fieldClass } from "@/app/dashboard/dashboard-ui";

type SearchContact = {
  id: string;
  name: string | null;
  countryCode: string;
  phoneNumber: string;
  email: string | null;
};

export function AddContactsToListModal({
  listId,
  open,
  onClose,
  onAdded,
}: {
  listId: string;
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<SearchContact[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (term: string) => {
    setIsLoading(true);

    try {
      const params = new URLSearchParams({ pageSize: "25" });
      if (term.trim()) params.set("search", term.trim());

      const response = await fetch(`/api/contacts?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        setContacts(data.contacts ?? []);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => {
      void load(search);
    }, 350);

    return () => clearTimeout(timer);
  }, [open, search, load]);

  if (!open) return null;

  function toggle(contactId: string) {
    setSelected((current) => {
      const next = new Set(current);

      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }

      return next;
    });
  }

  async function add() {
    if (selected.size === 0) {
      setError("Select at least one contact.");
      return;
    }

    setError("");
    setIsSaving(true);

    try {
      const response = await fetch(`/api/contacts/lists/${listId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: Array.from(selected) }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to add contacts.");
        return;
      }

      setSelected(new Set());
      onAdded();
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-[#BFE9D0] bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-[#081B3A]">Add contacts to list</h2>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#526173]" />
          <input
            className={`${fieldClass} py-2.5 pl-9`}
            placeholder="Search by name, phone, or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="mt-3 min-h-[200px] flex-1 overflow-y-auto rounded-xl border border-[#E7F8EF]">
          {contacts.map((contact) => (
            <label
              key={contact.id}
              className="flex cursor-pointer items-center gap-3 border-b border-[#E7F8EF] px-4 py-2.5 text-sm transition hover:bg-[#F7FCF9]"
            >
              <input
                type="checkbox"
                checked={selected.has(contact.id)}
                onChange={() => toggle(contact.id)}
                className="h-4 w-4 accent-[#128C7E]"
              />
              <span className="min-w-0 flex-1 truncate text-[#081B3A]">
                {contact.name || "Unnamed"}
              </span>
              <span className="flex-none text-xs text-[#526173]">
                +{contact.countryCode} {contact.phoneNumber}
              </span>
            </label>
          ))}

          {contacts.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-[#526173]">
              {isLoading ? "Searching..." : "No contacts found."}
            </p>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-[#526173]">{selected.size} selected</p>
          <div className="flex gap-3">
            <button
              type="button"
              className={actionButtonClass("secondary")}
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className={actionButtonClass("primary")}
              onClick={add}
              disabled={isSaving || selected.size === 0}
            >
              {isSaving ? "Adding..." : `Add ${selected.size || ""}`.trim()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
