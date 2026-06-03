"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RevokeWebhookEndpointButtonProps = {
  endpointId: string;
  disabled: boolean;
};

type RevokeWebhookEndpointResponse = {
  message: string;
};

export default function RevokeWebhookEndpointButton({
  endpointId,
  disabled,
}: RevokeWebhookEndpointButtonProps) {
  const router = useRouter();

  const [error, setError] = useState("");
  const [isRevoking, setIsRevoking] = useState(false);

  async function revokeEndpoint() {
    const confirmed = window.confirm(
      "Are you sure you want to revoke this webhook endpoint?",
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setIsRevoking(true);

    try {
      const response = await fetch(`/api/developer/webhooks/${endpointId}`, {
        method: "DELETE",
      });

      const data: RevokeWebhookEndpointResponse = await response.json();

      if (!response.ok) {
        setError(data.message);
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to revoke webhook endpoint. Please try again.");
    } finally {
      setIsRevoking(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={revokeEndpoint}
        disabled={disabled || isRevoking}
        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRevoking ? "Revoking..." : "Revoke"}
      </button>

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
