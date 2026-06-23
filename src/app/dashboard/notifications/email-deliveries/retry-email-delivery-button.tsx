"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type RetryEmailDeliveryButtonProps = {
  deliveryId: string;
  disabled?: boolean;
};

type RetryResponse = {
  message: string;
};

export default function RetryEmailDeliveryButton({
  deliveryId,
  disabled,
}: RetryEmailDeliveryButtonProps) {
  const router = useRouter();

  const [error, setError] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);

  async function retryDelivery() {
    setError("");
    setIsRetrying(true);

    try {
      const response = await fetch(
        `/api/notifications/email-deliveries/${deliveryId}/retry`,
        {
          method: "POST",
        },
      );

      const data = (await response.json()) as RetryResponse;

      if (!response.ok) {
        setError(data.message);
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to retry email delivery.");
    } finally {
      setIsRetrying(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={retryDelivery}
        disabled={disabled || isRetrying}
        className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRetrying ? "Retrying..." : "Retry"}
      </button>

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
