"use client";

import { LoaderCircle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { actionButtonClass } from "@/app/dashboard/dashboard-ui";

export default function CheckSubscriptionExpiryButton() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  async function checkExpiry() {
    setMessage("");
    setIsChecking(true);
    try {
      const response = await fetch("/api/billing/subscription/check-expiry", {
        method: "POST",
      });
      const data = (await response.json()) as {
        message: string;
        result?: { checkedCount: number; recoveredCount: number };
      };

      if (!response.ok) throw new Error(data.message);
      setMessage(
        `Checked ${data.result?.checkedCount ?? 0}, updated ${data.result?.recoveredCount ?? 0}.`,
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to check expiry.");
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void checkExpiry()}
        disabled={isChecking}
        className={actionButtonClass("secondary")}
      >
        {isChecking ? (
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="mr-2 h-4 w-4" />
        )}
        Check Expiry
      </button>
      {message ? <span className="max-w-56 text-right text-xs text-[#526173]">{message}</span> : null}
    </div>
  );
}
