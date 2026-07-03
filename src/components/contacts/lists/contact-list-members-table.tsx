"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { actionButtonClass, fieldClass } from "@/app/dashboard/dashboard-ui";
import { AddContactsToListModal } from "./add-contacts-to-list-modal";

type MemberContact = {
  memberId: string;
  id: string;
  name: string | null;
  countryCode: string;
  phoneNumber: string;
  email: string | null;
  city: string | null;
  optedOut: boolean;
  lastMessageAt: string | null;
  tags: string[];
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function ContactListMembersTable({ listId }: { listId: string }) {
  const router = useRouter();

  const [contacts, setContacts] = useState<MemberContact[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const load = useCallback(
    async (nextPage: number, term: string) => {
      setIsLoading(true);

      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          pageSize: "25",
        });
        if (term.trim()) params.set("search", term.trim());

        const response = await fetch(
          `/api/contacts/lists/${listId}/contacts?${params.toString()}`,
        );
        const data = await response.json();

        if (response.ok) {
          setContacts(data.contacts ?? []);
          setPagination(data.pagination ?? null);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [listId],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void load(page, search);
    }, 350);

    return () => clearTimeout(timer);
  }, [page, search, load]);

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

  async function removeSelected() {
    if (selected.size === 0) return;

    if (
      !window.confirm(
        `Remove ${selected.size} contact(s) from this list? The contacts themselves are not deleted.`,
      )
    ) {
      return;
    }

    setIsRemoving(true);

    try {
      const response = await fetch(`/api/contacts/lists/${listId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: Array.from(selected) }),
      });

      if (response.ok) {
        setSelected(new Set());
        await load(page, search);
        router.refresh();
      }
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#526173]" />
          <input
            className={`${fieldClass} py-2.5 pl-9`}
            placeholder="Search in this list"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="flex gap-3">
          {selected.size > 0 && (
            <button
              type="button"
              onClick={removeSelected}
              disabled={isRemoving}
              className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
            >
              {isRemoving ? "Removing..." : `Remove ${selected.size} selected`}
            </button>
          )}
          <button
            type="button"
            className={actionButtonClass("primary")}
            onClick={() => setIsAddOpen(true)}
          >
            <UserPlus className="mr-1.5 h-4 w-4" /> Add contacts
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-[#BFE9D0]">
        <table className="min-w-full divide-y divide-[#E7F8EF] text-left text-sm">
          <thead className="bg-[#E7F8EF]">
            <tr>
              <th className="w-10 px-4 py-3" />
              {["Name", "Phone", "Email", "Tags", "Last reply", "Opted out"].map(
                (header) => (
                  <th
                    key={header}
                    className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#128C7E]"
                  >
                    {header}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E7F8EF] bg-white">
            {contacts.map((contact) => (
              <tr key={contact.memberId}>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${contact.name ?? contact.phoneNumber}`}
                    checked={selected.has(contact.id)}
                    onChange={() => toggle(contact.id)}
                    className="h-4 w-4 accent-[#128C7E]"
                  />
                </td>
                <td className="max-w-[200px] truncate px-4 py-3 font-medium text-[#081B3A]">
                  {contact.name ?? "-"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[#102040]">
                  +{contact.countryCode} {contact.phoneNumber}
                </td>
                <td className="max-w-[200px] truncate px-4 py-3 text-[#526173]">
                  {contact.email ?? "-"}
                </td>
                <td className="max-w-[180px] truncate px-4 py-3 text-xs text-[#526173]">
                  {contact.tags.join(", ") || "-"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-[#526173]">
                  {contact.lastMessageAt
                    ? new Date(contact.lastMessageAt).toLocaleDateString()
                    : "-"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs">
                  {contact.optedOut ? (
                    <span className="font-semibold text-rose-600">Yes</span>
                  ) : (
                    <span className="text-[#526173]">No</span>
                  )}
                </td>
              </tr>
            ))}

            {contacts.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-[#526173]">
                  {isLoading
                    ? "Loading contacts..."
                    : "No contacts in this list yet. Add contacts manually or assign a list during import."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-[#526173]">
          <span>
            Page {pagination.page} of {pagination.totalPages} ·{" "}
            {pagination.total.toLocaleString("en-IN")} contacts
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              className="rounded-lg border border-[#BFE9D0] px-3 py-1 font-semibold text-[#128C7E] disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border border-[#BFE9D0] px-3 py-1 font-semibold text-[#128C7E] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <AddContactsToListModal
        listId={listId}
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onAdded={() => {
          void load(page, search);
          router.refresh();
        }}
      />
    </div>
  );
}
