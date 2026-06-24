"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ScanSubscriptionRenewalsButton() {
  const router = useRouter();
  const [isScanning, setIsScanning] = useState(false);

  async function scan() {
    setIsScanning(true);

    try {
      await fetch("/api/billing/subscription-renewals/scan", {
        method: "POST",
      });

      router.refresh();
    } finally {
      setIsScanning(false);
    }
  }

  return (
    <button
      type="button"
      onClick={scan}
      disabled={isScanning}
      className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-60"
    >
      <RefreshCw className={`h-4 w-4 ${isScanning ? "animate-spin" : ""}`} />
      {isScanning ? "Scanning..." : "Scan Renewals"}
    </button>
  );
}
