"use client";

import { Workflow } from "lucide-react";

export default function CustomerJourneyEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-[#D8E6F3] text-center p-6 space-y-3">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#F0F8FF] text-[#0052CC]">
        <Workflow className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-bold text-[#081B3A]">No customer journey yet</h3>
      <p className="text-xs text-[#526173] max-w-sm leading-relaxed">
        Messages, campaigns, payments, and automation activity will appear here.
      </p>
    </div>
  );
}
