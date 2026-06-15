"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { actionButtonClass } from "@/app/dashboard/dashboard-ui";

type StartCampaignButtonProps = {
  campaignId: string;
};

type StartCampaignResponse = {
  message: string;
};

export default function StartCampaignButton({
  campaignId,
}: StartCampaignButtonProps) {
  const router = useRouter();

  const [error, setError] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  async function startCampaign() {
    setError("");
    setIsStarting(true);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/start`, {
        method: "POST",
      });

      const data: StartCampaignResponse = await response.json();

      if (!response.ok) {
        setError(data.message);
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to start campaign. Please try again.");
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        onClick={startCampaign}
        disabled={isStarting}
        className={actionButtonClass()}
      >
        {isStarting ? "Starting..." : "Start Campaign"}
      </button>

      {error ? (
        <p className="mt-2 rounded-xl border border-rose-300/20 bg-rose-400/10 p-2 text-sm text-rose-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
