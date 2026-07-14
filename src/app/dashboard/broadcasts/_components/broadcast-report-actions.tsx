"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { actionButtonClass } from "@/app/dashboard/dashboard-ui";

type BroadcastReportActionsProps = {
  campaignId: string;
  latestReportId?: string | null;
};

export function BroadcastReportActions({
  campaignId,
  latestReportId,
}: BroadcastReportActionsProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  async function generateReport() {
    setError("");
    setIsGenerating(true);

    try {
      const response = await fetch("/api/campaign-reports", {
        body: JSON.stringify({ campaignId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || "Unable to generate report.");
      }

      router.refresh();
    } catch (reportError) {
      setError(
        reportError instanceof Error
          ? reportError.message
          : "Unable to generate report.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          className={actionButtonClass("secondary")}
          disabled={isGenerating}
          onClick={generateReport}
          type="button"
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          {isGenerating ? "Generating..." : "Generate report"}
        </button>
        {latestReportId ? (
          <Link
            className={actionButtonClass("primary")}
            href={`/api/campaign-reports/${latestReportId}/download`}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Link>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 text-sm font-semibold text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}
