"use client";

import { useCallback, useEffect, useState } from "react";

type SegmentContact = {
  id: string;
  name: string | null;
  countryCode: string;
  phoneNumber: string;
  email: string | null;
  city: string | null;
  optedOut: boolean;
  tags: string[];
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function SegmentContactsTable({ segmentId }: { segmentId: string }) {
  const [contacts, setContacts] = useState<SegmentContact[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(
    async (nextPage: number) => {
      setIsLoading(true);

      try {
        const response = await fetch(
          `/api/contact-segments/${segmentId}/contacts?page=${nextPage}&pageSize=25`,
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
    [segmentId],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void load(page);
    }, 0);

    return () => clearTimeout(timer);
  }, [page, load]);

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-[#BFE9D0]">
        <table className="min-w-full divide-y divide-[#E7F8EF] text-left text-sm">
          <thead className="bg-[#E7F8EF]">
            <tr>
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
                <td className="max-w-[200px] truncate px-4 py-3 text-xs text-[#526173]">
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
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-[#526173]">
                  {isLoading ? "Loading contacts..." : "No contacts match this segment."}
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
