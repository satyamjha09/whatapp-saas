"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export default function AutomationTestContextViewer({
  context,
}: {
  context: unknown;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-[#D6EADF] bg-white">
      <button
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-bold text-[#081B3A]"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        Current context
        {open ? (
          <ChevronDown className="h-4 w-4 text-[#128C7E]" />
        ) : (
          <ChevronRight className="h-4 w-4 text-[#128C7E]" />
        )}
      </button>
      {open ? (
        <pre className="max-h-80 overflow-auto border-t border-[#E7F8EF] bg-[#081B3A] p-4 text-xs leading-5 text-[#DFF8EB]">
          {JSON.stringify(context ?? {}, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
