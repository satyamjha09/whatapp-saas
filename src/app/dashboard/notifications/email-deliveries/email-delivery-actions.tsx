"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ActionResponse = {
  message: string;
  retriedCount?: number;
};

export default function EmailDeliveryActions() {
  const router = useRouter();

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [activeAction, setActiveAction] = useState("");

  async function runAction(action: "retry-failed" | "test-email") {
    const confirmed =
      action === "retry-failed"
        ? window.confirm("Retry up to 100 failed/skipped email deliveries?")
        : true;

    if (!confirmed) return;

    setMessage("");
    setError("");
    setActiveAction(action);

    try {
      const response = await fetch(
        action === "retry-failed"
          ? "/api/notifications/email-deliveries/retry-failed"
          : "/api/notifications/email-deliveries/test-email",
        {
          method: "POST",
        },
      );

      const data = (await response.json()) as ActionResponse;

      if (!response.ok) {
        setError(data.message);
        return;
      }

      setMessage(
        action === "retry-failed"
          ? `Queued ${data.retriedCount ?? 0} email delivery attempt(s).`
          : data.message,
      );

      router.refresh();
    } catch {
      setError("Unable to run email delivery action.");
    } finally {
      setActiveAction("");
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-3">
      <div>
        <button
          type="button"
          onClick={() => runAction("test-email")}
          disabled={Boolean(activeAction)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {activeAction === "test-email" ? "Sending..." : "Send Test Email"}
        </button>
      </div>

      <div>
        <button
          type="button"
          onClick={() => runAction("retry-failed")}
          disabled={Boolean(activeAction)}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {activeAction === "retry-failed"
            ? "Retrying..."
            : "Retry Failed Emails"}
        </button>
      </div>

      {message ? <p className="w-full text-xs text-green-700">{message}</p> : null}
      {error ? <p className="w-full text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
