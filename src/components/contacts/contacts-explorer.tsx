"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  MoreHorizontal,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { fieldClass } from "@/app/dashboard/dashboard-ui";
import { ContactProfileDrawer } from "@/components/contacts/contact-profile-drawer";

type ExplorerContact = {
  id: string;
  name: string | null;
  countryCode: string;
  phoneNumber: string;
  email: string | null;
  city: string | null;
  companyName: string | null;
  source: string;
  lifecycleStage: string;
  marketingConsentStatus: string;
  utilityConsentStatus: string;
  isBlocked: boolean;
  optedOut: boolean;
  lastMessageAt: string | null;
  tags: string[];
  lists: Array<{ id: string; name: string }>;
  createdAt: string;
  updatedAt: string;
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
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [consent, setConsent] = useState("");
  const [page, setPage] = useState(1);

  const [contacts, setContacts] = useState<ExplorerContact[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [profileContactId, setProfileContactId] = useState<string | null>(null);
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
      if (source) params.set("source", source);
      if (status) params.set("status", status);
      if (consent) params.set("consent", consent);

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
  }, [page, search, listId, segmentId, tag, source, status, consent]);

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

  function clearFilters() {
    setSearch("");
    setListId("");
    setSegmentId("");
    setTag("");
    setSource("");
    setStatus("");
    setConsent("");
    setPage(1);
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

  const hasFilters =
    search.trim() || listId || segmentId || tag.trim() || source || status || consent;

  return (
    <div>
      {/* Filters */}
      <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_150px_150px_150px_160px_auto]">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#526173]" />
          <input
            aria-label="Search contacts"
            className={`${fieldClass} py-2.5 pl-9`}
            placeholder="Search by name, phone or email..."
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

        <select
          aria-label="Filter by source"
          className={`${fieldClass} py-2.5`}
          value={source}
          onChange={(event) => {
            setSource(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All sources</option>
          <option value="MANUAL">Manual</option>
          <option value="IMPORT">Import</option>
          <option value="CSV_IMPORT">CSV import</option>
          <option value="GROUP_IMPORT">Group import</option>
          <option value="PUBLIC_API">Public API</option>
          <option value="WHATSAPP">WhatsApp</option>
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
          aria-label="Filter by status"
          className={`${fieldClass} py-2.5`}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
        </select>

        <select
          aria-label="Filter by consent"
          className={`${fieldClass} py-2.5`}
          value={consent}
          onChange={(event) => {
            setConsent(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Any consent</option>
          <option value="marketing_granted">Marketing granted</option>
          <option value="marketing_unknown">Marketing unknown</option>
          <option value="marketing_revoked">Marketing revoked</option>
          <option value="utility_granted">Utility granted</option>
          <option value="utility_unknown">Utility unknown</option>
          <option value="utility_revoked">Utility revoked</option>
          <option value="opted_out">Opted out</option>
        </select>

        <button
          type="button"
          onClick={clearFilters}
          disabled={!hasFilters}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#BFE9D0] px-4 text-sm font-semibold text-[#128C7E] transition hover:bg-[#F0FBF6] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <X className="h-4 w-4" />
          Clear
        </button>
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
        <table className="w-full min-w-[980px] table-fixed divide-y divide-[#E7F8EF] text-left text-sm">
          <thead className="bg-[#E7F8EF]">
            <tr>
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={contacts.length > 0 && selected.size === contacts.length}
                  onChange={toggleAll}
                  onClick={(event) => event.stopPropagation()}
                  className="h-4 w-4 accent-[#128C7E]"
                />
              </th>
              <th className="w-[22%] px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[#128C7E]">
                Contact
              </th>
              <th className="w-[16%] px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[#128C7E]">
                Phone
              </th>
              <th className="w-[18%] px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[#128C7E]">
                Email
              </th>
              <th className="w-[14%] px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[#128C7E]">
                Labels
              </th>
              <th className="w-[12%] px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[#128C7E]">
                Source
              </th>
              <th className="w-[14%] px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[#128C7E]">
                Last activity
              </th>
              <th className="w-[13%] px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[#128C7E]">
                Created
              </th>
              <th className="w-[10%] px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[#128C7E]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E7F8EF] bg-white">
            {contacts.map((contact) => (
              <tr
                key={contact.id}
                className="cursor-pointer transition hover:bg-[#F8FFFB]"
                onClick={() => setProfileContactId(contact.id)}
              >
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${contact.name ?? contact.phoneNumber}`}
                    checked={selected.has(contact.id)}
                    onChange={() => toggle(contact.id)}
                    onClick={(event) => event.stopPropagation()}
                    className="h-4 w-4 accent-[#128C7E]"
                  />
                </td>
                <td className="min-w-0 px-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#E7F8EF] text-[#128C7E]">
                      <UserRound className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#081B3A]">
                        {contact.name ?? contact.phoneNumber}
                      </p>
                      <p className="truncate text-xs text-[#526173]">
                        {contact.isBlocked
                          ? "Blocked contact"
                          : contact.optedOut
                            ? "Opted out"
                            : "WhatsApp contact"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="truncate px-3 py-3 text-[#102040]">
                  +{contact.countryCode}{contact.phoneNumber}
                </td>
                <td className="truncate px-3 py-3 text-[#526173]">
                  {contact.email ?? "-"}
                </td>
                <td className="px-3 py-3">
                  {contact.tags.length > 0 ? (
                    <div className="flex min-w-0 flex-wrap gap-1">
                      {contact.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-[#E7F8EF] px-2 py-1 text-[11px] font-semibold text-[#075E54]"
                        >
                          {tag}
                        </span>
                      ))}
                      {contact.tags.length > 2 ? (
                        <span className="text-[11px] text-[#526173]">
                          +{contact.tags.length - 2}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-[#526173]">-</span>
                  )}
                </td>
                <td className="truncate px-3 py-3 text-xs text-[#526173]">
                  {contact.source.replaceAll("_", " ")}
                </td>
                <td className="truncate px-3 py-3 text-xs text-[#526173]">
                  {contact.lastMessageAt
                    ? new Date(contact.lastMessageAt).toLocaleDateString("en-IN")
                    : "No activity"}
                </td>
                <td className="truncate px-3 py-3 text-xs text-[#526173]">
                  {new Date(contact.createdAt).toLocaleDateString("en-IN")}
                </td>
                <td className="px-3 py-3">
                  <div
                    className="flex min-w-0 items-center justify-end gap-1.5"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Link
                      href={`/dashboard/contacts/${contact.id}/crm`}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E7F8EF] text-[#075E54] transition hover:bg-[#D7F2E4]"
                      aria-label={`Open CRM and consent for ${contact.name ?? contact.phoneNumber}`}
                      title="CRM and consent"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                    </Link>
                    <Link
                      href={`/dashboard/contacts/${contact.id}/timeline`}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#BFE9D0] text-[#128C7E] transition hover:bg-[#F0FBF6]"
                      aria-label={`Open timeline for ${contact.name ?? contact.phoneNumber}`}
                      title="Timeline"
                    >
                      <Clock3 className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setProfileContactId(contact.id)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#BFE9D0] text-[#128C7E] transition hover:bg-[#F0FBF6]"
                      aria-label={`View profile for ${contact.name ?? contact.phoneNumber}`}
                      title="View profile"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {contacts.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-[#526173]">
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

      {pagination ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-[#526173]">
          <CheckCircle2 className="h-3.5 w-3.5 text-[#128C7E]" />
          <span>{pagination.total.toLocaleString("en-IN")} matching contacts</span>
        </div>
      ) : null}

      <ContactProfileDrawer
        contactId={profileContactId}
        onClose={() => setProfileContactId(null)}
      />
    </div>
  );
}
