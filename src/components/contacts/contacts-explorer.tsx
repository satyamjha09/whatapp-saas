"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { fieldClass } from "@/app/dashboard/dashboard-ui";

type ExplorerContact = {
  id: string;
  name: string | null;
  countryCode: string;
  phoneNumber: string;
  email: string | null;
  city: string | null;
  optedOut: boolean;
  tags: string[];
  createdAt: string;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type Option = { id: string; name: string };

type BulkAction = "ADD_TO_LIST" | "REMOVE_FROM_LIST" | "ADD_TAG" | "REMOVE_TAG";

export function ContactsExplorer({
  lists,
  segments,
}: {
  lists: Option[];
  segments: Option[];
}) {
  const [search, setSearch] = useState("");
  const [listId, setListId] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [tag, setTag] = useState("");
  const [optedOut, setOptedOut] = useState("");
  const [page, setPage] = useState(1);

  const [contacts, setContacts] = useState<ExplorerContact[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [bulkAction, setBulkAction] = useState<BulkAction>("ADD_TO_LIST");
  const [bulkListId, setBulkListId] = useState("");
  const [bulkTagName, setBulkTagName] = useState("");
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "25",
      });

      if (search.trim()) params.set("search", search.trim());
      if (listId) params.set("listId", listId);
      if (segmentId) params.set("segmentId", segmentId);
      if (tag.trim()) params.set("tag", tag.trim());
      if (optedOut) params.set("optedOut", optedOut);

      const response = await fetch(`/api/contacts?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to load contacts.");
        return;
      }

      setContacts(data.contacts ?? []);
      setPagination(data.pagination ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, listId, segmentId, tag, optedOut]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 350);

    return () => clearTimeout(timer);
  }, [load]);

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

  function toggleAll() {
    setSelected((current) =>
      current.size === contacts.length
        ? new Set()
        : new Set(contacts.map((contact) => contact.id)),
    );
  }

  async function runBulk() {
    if (selected.size === 0) return;

    const needsList = bulkAction === "ADD_TO_LIST" || bulkAction === "REMOVE_FROM_LIST";
    const needsTag = bulkAction === "ADD_TAG" || bulkAction === "REMOVE_TAG";

    if (needsList && !bulkListId) {
      setBulkMessage("Choose a list first.");
      return;
    }

    if (needsTag && !bulkTagName.trim()) {
      setBulkMessage("Enter a tag name first.");
      return;
    }

    setIsBulkRunning(true);
    setBulkMessage("");

    try {
      const response = await fetch("/api/contacts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: bulkAction,
          contactIds: Array.from(selected),
          listId: needsList ? bulkListId : undefined,
          tagName: needsTag ? bulkTagName.trim() : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setBulkMessage(data.message ?? "Bulk action failed.");
        return;
      }

      setBulkMessage(`Done - ${data.affected} contact(s) updated.`);
      setSelected(new Set());
      void load();
    } finally {
      setIsBulkRunning(false);
    }
  }

  return (
    <div>
      {/* Filters */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#526173]" />
          <input
            aria-label="Search contacts"
            className={`${fieldClass} py-2.5 pl-9`}
            placeholder="Search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>

        <select
          aria-label="Filter by list"
          className={`${fieldClass} py-2.5`}
          value={listId}
          onChange={(event) => {
            setListId(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All lists</option>
          {lists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by segment"
          className={`${fieldClass} py-2.5`}
          value={segmentId}
          onChange={(event) => {
            setSegmentId(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All segments</option>
          {segments.map((segment) => (
            <option key={segment.id} value={segment.id}>
              {segment.name}
            </option>
          ))}
        </select>

        <input
          aria-label="Filter by tag"
          className={`${fieldClass} py-2.5`}
          placeholder="Tag"
          value={tag}
          onChange={(event) => {
            setTag(event.target.value);
            setPage(1);
          }}
        />

        <select
          aria-label="Filter by opt-out status"
          className={`${fieldClass} py-2.5`}
          value={optedOut}
          onChange={(event) => {
            setOptedOut(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Opt-out: any</option>
          <option value="false">Active only</option>
          <option value="true">Opted out only</option>
        </select>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[#BFE9D0] bg-[#E7F8EF] p-3">
          <span className="text-sm font-semibold text-[#081B3A]">
            {selected.size} selected
          </span>

          <select
            aria-label="Bulk action"
            className={`${fieldClass} w-auto py-2`}
            value={bulkAction}
            onChange={(event) => setBulkAction(event.target.value as BulkAction)}
          >
            <option value="ADD_TO_LIST">Add to list</option>
            <option value="REMOVE_FROM_LIST">Remove from list</option>
            <option value="ADD_TAG">Add tag</option>
            <option value="REMOVE_TAG">Remove tag</option>
          </select>

          {(bulkAction === "ADD_TO_LIST" || bulkAction === "REMOVE_FROM_LIST") && (
            <select
              aria-label="Bulk list"
              className={`${fieldClass} w-auto py-2`}
              value={bulkListId}
              onChange={(event) => setBulkListId(event.target.value)}
            >
              <option value="">Choose list...</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          )}

          {(bulkAction === "ADD_TAG" || bulkAction === "REMOVE_TAG") && (
            <input
              aria-label="Bulk tag name"
              className={`${fieldClass} w-auto py-2`}
              placeholder="Tag name"
              value={bulkTagName}
              onChange={(event) => setBulkTagName(event.target.value)}
            />
          )}

          <button
            type="button"
            onClick={runBulk}
            disabled={isBulkRunning}
            className="inline-flex items-center justify-center rounded-xl bg-[#128C7E] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#075E54] disabled:opacity-50"
          >
            {isBulkRunning ? "Applying..." : "Apply"}
          </button>

          {bulkMessage && (
            <span className="text-xs text-[#526173]">{bulkMessage}</span>
          )}
        </div>
      )}

      {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}

      {/* Table */}
      <div className="mt-4 overflow-x-auto rounded-2xl border border-[#BFE9D0]">
        <table className="min-w-full divide-y divide-[#E7F8EF] text-left text-sm">
          <thead className="bg-[#E7F8EF]">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={contacts.length > 0 && selected.size === contacts.length}
                  onChange={toggleAll}
                  className="h-4 w-4 accent-[#128C7E]"
                />
              </th>
              {["Name", "Phone", "Email", "City", "Tags", "Opted out"].map((header) => (
                <th
                  key={header}
                  className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#128C7E]"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E7F8EF] bg-white">
            {contacts.map((contact) => (
              <tr key={contact.id}>
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
                <td className="whitespace-nowrap px-4 py-3 text-[#526173]">
                  {contact.city ?? "-"}
                </td>
                <td className="max-w-[180px] truncate px-4 py-3 text-xs text-[#526173]">
                  {contact.tags.join(", ") || "-"}
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
                  {isLoading ? "Loading contacts..." : "No contacts match these filters."}
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
    </div>
  );
}
