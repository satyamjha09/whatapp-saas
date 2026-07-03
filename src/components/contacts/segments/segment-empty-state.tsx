"use client";

import Link from "next/link";
import { Filter } from "lucide-react";
import { actionButtonClass } from "@/app/dashboard/dashboard-ui";

export function SegmentEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#BFE9D0] bg-[#F7FCF9] px-6 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#E7F8EF] text-[#128C7E]">
        <Filter className="h-6 w-6" />
      </span>
      <p className="text-sm font-semibold text-[#081B3A]">No smart segments yet</p>
      <p className="max-w-md text-sm text-[#526173]">
        Create dynamic audiences using contact data and campaign behaviour.
        Contacts enter and leave segments automatically.
      </p>
      <Link
        href="/dashboard/contacts/segments/new"
        className={actionButtonClass("primary")}
      >
        Create segment
      </Link>
    </div>
  );
}
