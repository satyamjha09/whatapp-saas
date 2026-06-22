"use client";

import { useState } from "react";

export default function CopyJsonButton({ value }: { value: unknown }) {
  const [copied, setCopied] = useState(false);

  async function copyJson() {
    await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  }

  return (
    <button
      type="button"
      onClick={copyJson}
      className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700"
    >
      {copied ? "Copied" : "Copy JSON"}
    </button>
  );
}
