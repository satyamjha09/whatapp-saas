"use client";

import { Users } from "lucide-react";
import type { SegmentPreviewResult } from "./segment-builder";

export function SegmentPreviewCount({
  preview,
  isLoading,
  error,
}: {
  preview: SegmentPreviewResult | null;
  isLoading: boolean;
  error: string;
}) {
  return (
    <div className="rounded-2xl border border-[#BFE9D0] bg-white p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E7F8EF] text-[#128C7E]">
          <Users className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#526173]">
            Matching contacts
          </p>
          <p className="text-2xl font-bold text-[#081B3A]">
            {isLoading ? "..." : (preview?.count ?? 0).toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {preview && preview.warnings.length > 0 && (
        <ul className="mt-3 space-y-1">
          {preview.warnings.map((warning) => (
            <li key={warning} className="text-xs text-amber-700">
              ⚠ {warning}
            </li>
          ))}
        </ul>
      )}

      {preview && preview.sampleContacts.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#526173]">
            Sample
          </p>
          <ul className="mt-2 divide-y divide-[#E7F8EF]">
            {preview.sampleContacts.map((contact) => (
              <li key={contact.id} className="flex items-center justify-between py-2 text-sm">
                <span className="truncate text-[#102040]">
                  {contact.name || "Unnamed"}
                </span>
                <span className="ml-3 flex-none text-xs text-[#526173]">
                  +{contact.countryCode} {contact.phoneNumber}
                  {contact.optedOut ? " · opted out" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
