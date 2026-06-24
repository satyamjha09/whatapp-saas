"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PrivacyRequestButtons({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<
    "CONTACT_EXPORT" | "CONTACT_DELETE" | null
  >(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function createRequest(type: "CONTACT_EXPORT" | "CONTACT_DELETE") {
    setPendingAction(type);
    setMessage("");
    setError("");

    try {
      const body =
        type === "CONTACT_DELETE"
          ? {
              contactId,
              type,
              reason: "Customer requested deletion",
              confirmationText: "DELETE CONTACT DATA",
            }
          : {
              contactId,
              type,
              reason: "Customer requested data export",
            };

      const response = await fetch("/api/privacy/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to create privacy request");
        return;
      }

      setMessage(
        type === "CONTACT_DELETE"
          ? "Deletion request created."
          : "Export request created.",
      );
      router.refresh();
    } catch {
      setError("Unable to create privacy request");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
      <p className="text-xs font-semibold uppercase text-blue-900">
        Privacy
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => createRequest("CONTACT_EXPORT")}
          disabled={pendingAction !== null}
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          {pendingAction === "CONTACT_EXPORT"
            ? "Creating..."
            : "Request Export"}
        </button>

        <button
          type="button"
          onClick={() => createRequest("CONTACT_DELETE")}
          disabled={pendingAction !== null}
          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-60"
        >
          {pendingAction === "CONTACT_DELETE"
            ? "Creating..."
            : "Request Delete"}
        </button>
      </div>

      {message ? <p className="mt-2 text-xs text-green-700">{message}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}

      <a
        href="/dashboard/system/privacy"
        className="mt-3 inline-block text-xs font-medium text-blue-900 underline"
      >
        Open Privacy Center
      </a>
    </div>
  );
}
