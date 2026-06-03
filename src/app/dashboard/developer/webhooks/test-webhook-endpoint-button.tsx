"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TestWebhookEndpointButtonProps = {
  endpointId: string;
  disabled: boolean;
};

type TestWebhookEndpointResponse = {
  message: string;
};

export default function TestWebhookEndpointButton({
  endpointId,
  disabled,
}: TestWebhookEndpointButtonProps) {
  const router = useRouter();

  const [error, setError] = useState("");
  const [isTesting, setIsTesting] = useState(false);

  async function testEndpoint() {
    setError("");
    setIsTesting(true);

    try {
      const response = await fetch(`/api/developer/webhooks/${endpointId}/test`, {
        method: "POST",
      });

      const data: TestWebhookEndpointResponse = await response.json();

      if (!response.ok) {
        setError(data.message);
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to test webhook endpoint. Please try again.");
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={testEndpoint}
        disabled={disabled || isTesting}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isTesting ? "Testing..." : "Test"}
      </button>

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
