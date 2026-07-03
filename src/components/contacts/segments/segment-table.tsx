"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StatusPill, statusTone } from "@/app/dashboard/dashboard-ui";

type SegmentRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  matchMode: string;
  ruleCount: number;
  lastPreviewCount: number | null;
  updatedAt: string;
};

export function SegmentTable({ segments }: { segments: SegmentRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");

  async function remove(segmentId: string, name: string) {
    if (!window.confirm(`Delete segment "${name}"? Contacts are not affected.`)) {
      return;
    }

    setBusyId(segmentId);

    try {
      const response = await fetch(`/api/contact-segments/${segmentId}`, {
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
    <div className="overflow-x-auto rounded-2xl border border-[#BFE9D0]">
      <table className="min-w-full divide-y divide-[#E7F8EF] text-left text-sm">
        <thead className="bg-[#E7F8EF]">
          <tr>
            {["Name", "Status", "Match", "Rules", "Last count", "Updated", "Actions"].map(
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
          {segments.map((segment) => (
            <tr key={segment.id}>
              <td className="px-4 py-3">
                <Link
                  href={`/dashboard/contacts/segments/${segment.id}`}
                  className="font-semibold text-[#081B3A] hover:text-[#128C7E] hover:underline"
                >
                  {segment.name}
                </Link>
                {segment.description && (
                  <p className="mt-0.5 max-w-[280px] truncate text-xs text-[#526173]">
                    {segment.description}
                  </p>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <StatusPill tone={statusTone(segment.status)}>
                  {segment.status}
                </StatusPill>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-[#526173]">
                {segment.matchMode === "ALL" ? "AND" : "OR"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-[#526173]">
                {segment.ruleCount}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-[#102040]">
                {segment.lastPreviewCount === null
                  ? "-"
                  : segment.lastPreviewCount.toLocaleString("en-IN")}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-xs text-[#526173]">
                {new Date(segment.updatedAt).toLocaleDateString()}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <div className="flex gap-3 text-xs font-semibold">
                  <Link
                    href={`/dashboard/contacts/segments/${segment.id}`}
                    className="text-[#128C7E] hover:underline"
                  >
                    View
                  </Link>
                  <button
                    type="button"
                    disabled={busyId === segment.id}
                    onClick={() => remove(segment.id, segment.name)}
                    className="text-rose-600 hover:underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
