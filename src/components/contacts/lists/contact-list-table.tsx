"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { actionButtonClass, fieldClass } from "@/app/dashboard/dashboard-ui";
import { CreateContactListModal } from "./create-contact-list-modal";

type ContactListRow = {
  id: string;
  name: string;
  description: string | null;
  contactsCount: number;
  createdAt: string;
};

export function ContactListTable({ lists }: { lists: ContactListRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return lists;

    return lists.filter(
      (list) =>
        list.name.toLowerCase().includes(term) ||
        (list.description ?? "").toLowerCase().includes(term),
    );
  }, [lists, search]);

  async function rename(list: ContactListRow) {
    const nextName = window.prompt("Rename list", list.name)?.trim();

    if (!nextName || nextName === list.name) return;

    setBusyId(list.id);

    try {
      const response = await fetch(`/api/contacts/lists/${list.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });

      if (!response.ok) {
        const data = await response.json();
        window.alert(data.message ?? "Unable to rename list.");
        return;
      }

      router.refresh();
    } finally {
      setBusyId("");
    }
  }

  async function remove(list: ContactListRow) {
    if (
      !window.confirm(
        `Delete list "${list.name}"? Contacts are not deleted, only the list.`,
      )
    ) {
      return;
    }

    setBusyId(list.id);

    try {
      const response = await fetch(`/api/contacts/lists/${list.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.refresh();
      }
    } finally {
      setBusyId("");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#526173]" />
          <input
            className={`${fieldClass} py-2.5 pl-9`}
            placeholder="Search lists"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <button
          type="button"
          className={actionButtonClass("primary")}
          onClick={() => setIsCreateOpen(true)}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Create list
        </button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-[#BFE9D0]">
        <table className="min-w-full divide-y divide-[#E7F8EF] text-left text-sm">
          <thead className="bg-[#E7F8EF]">
            <tr>
              {["Name", "Description", "Contacts", "Created", "Actions"].map(
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
            {filtered.map((list) => (
              <tr key={list.id}>
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/contacts/lists/${list.id}`}
                    className="font-semibold text-[#081B3A] hover:text-[#128C7E] hover:underline"
                  >
                    {list.name}
                  </Link>
                </td>
                <td className="max-w-[320px] truncate px-4 py-3 text-[#526173]">
                  {list.description ?? "-"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[#102040]">
                  {list.contactsCount.toLocaleString("en-IN")}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-[#526173]">
                  {new Date(list.createdAt).toLocaleDateString()}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex gap-3 text-xs font-semibold">
                    <Link
                      href={`/dashboard/contacts/lists/${list.id}`}
                      className="text-[#128C7E] hover:underline"
                    >
                      View
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === list.id}
                      onClick={() => rename(list)}
                      className="text-[#128C7E] hover:underline disabled:opacity-50"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      disabled={busyId === list.id}
                      onClick={() => remove(list)}
                      className="text-rose-600 hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-[#526173]">
                  No contact lists yet. Create a list to organize imported contacts
                  for broadcasting.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CreateContactListModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </div>
  );
}
