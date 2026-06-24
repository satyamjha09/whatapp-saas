"use client";

import { Check, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ScanQuotaAlertsButton() {
  const router = useRouter();
  const [isScanning, setIsScanning] = useState(false);

  async function scan() {
    setIsScanning(true);

    try {
      await fetch("/api/billing/usage-quota-alerts/scan", {
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
      {isScanning ? "Scanning..." : "Scan Alerts"}
    </button>
  );
}

export function AcknowledgeQuotaAlertButton({
  alertId,
}: {
  alertId: string;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  async function acknowledge() {
    setIsSaving(true);

    try {
      await fetch(`/api/billing/usage-quota-alerts/${alertId}/acknowledge`, {
        method: "POST",
      });

      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={acknowledge}
      disabled={isSaving}
      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-60"
    >
      <Check className="h-3.5 w-3.5" />
      {isSaving ? "Saving..." : "Acknowledge"}
    </button>
  );
}
