"use client";

import { useCallback, useEffect, useState } from "react";
import { StatusPill, statusTone } from "@/app/dashboard/dashboard-ui";
import type { ImportRow } from "./types";

const TABS = [
  { value: "INVALID", label: "Invalid rows" },
  { value: "DUPLICATE", label: "Duplicates" },
  { value: "FAILED", label: "Failed rows" },
] as const;

export function ContactImportErrorsTable({ importId }: { importId: string }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("INVALID");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const pageSize = 25;

  const load = useCallback(
    async (nextTab: string, nextPage: number) => {
      setIsLoading(true);

      try {
        const response = await fetch(
          `/api/contacts/import/${importId}/rows?status=${nextTab}&page=${nextPage}&pageSize=${pageSize}`,
        );
        const data = await response.json();

        if (response.ok) {
          setRows(data.rows ?? []);
          setTotal(data.total ?? 0);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [importId],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void load(tab, page);
    }, 0);

    return () => clearTimeout(timer);
  }, [tab, page, load]);

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((entry) => (
          <button
            key={entry.value}
            type="button"
            onClick={() => {
              setTab(entry.value);
              setPage(1);
            }}
            className={[
              "rounded-full px-4 py-1.5 text-xs font-semibold transition",
              tab === entry.value
                ? "bg-[#128C7E] text-white"
                : "bg-[#E7F8EF] text-[#128C7E] hover:bg-[#BFE9D0]",
            ].join(" ")}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-[#BFE9D0]">
        <table className="min-w-full divide-y divide-[#E7F8EF] text-left text-sm">
          <thead className="bg-[#E7F8EF]">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-[#128C7E]">
                Row
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-[#128C7E]">
                Status
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-[#128C7E]">
                Phone
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-[#128C7E]">
                Name
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-[#128C7E]">
                Details
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E7F8EF] bg-white">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="whitespace-nowrap px-4 py-2.5 text-[#526173]">
                  #{row.rowNumber}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-[#102040]">
                  {row.phone ? `+${row.countryCode ?? ""} ${row.phone}` : "-"}
                </td>
                <td className="max-w-[180px] truncate px-4 py-2.5 text-[#102040]">
                  {row.name ?? "-"}
                </td>
                <td className="max-w-[320px] px-4 py-2.5 text-xs text-[#526173]">
                  {row.errorMessage ??
                    (Array.isArray(row.warnings) ? row.warnings.join(" ") : "-")}
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-[#526173]"
                >
                  {isLoading ? "Loading rows..." : "No rows in this category."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-[#526173]">
          <span>
            Page {page} of {totalPages} · {total.toLocaleString("en-IN")} rows
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
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
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
