"use client";

import { RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { actionButtonClass } from "@/app/dashboard/dashboard-ui";

export function RunMonitoringChecksButton() {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);

  async function runChecks() {
    setIsRunning(true);

    try {
      const response = await fetch("/api/automation/monitoring/run-checks", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Unable to run checks");
      }

      router.refresh();
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <button
      className={actionButtonClass("secondary")}
      disabled={isRunning}
      onClick={() => void runChecks()}
      type="button"
    >
      <RefreshCcw className="mr-2 h-4 w-4" />
      {isRunning ? "Running..." : "Run checks"}
    </button>
  );
}
