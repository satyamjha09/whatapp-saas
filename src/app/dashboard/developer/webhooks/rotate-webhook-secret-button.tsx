"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RotateWebhookSecretButtonProps = {
  endpointId: string;
};

type RotateSecretResponse = {
  message: string;
  signingSecret?: string;
};

export default function RotateWebhookSecretButton({
  endpointId,
}: RotateWebhookSecretButtonProps) {
  const router = useRouter();

  const [error, setError] = useState("");
  const [newSecret, setNewSecret] = useState("");
  const [isRotating, setIsRotating] = useState(false);

  async function rotateSecret() {
    const confirmed = window.confirm(
      "Rotate this webhook signing secret? Existing receivers must be updated to verify the new secret.",
    );

    if (!confirmed) return;

    setError("");
    setNewSecret("");
    setIsRotating(true);

    try {
      const response = await fetch(
        `/api/developer/webhooks/${endpointId}/rotate-secret`,
        {
          method: "POST",
        },
      );
      const data = (await response.json()) as RotateSecretResponse;

      if (!response.ok) {
        setError(data.message);
        return;
      }

      setNewSecret(data.signingSecret ?? "");
      router.refresh();
    } catch {
      setError("Unable to rotate signing secret.");
    } finally {
      setIsRotating(false);
    }
  }

  async function copySecret() {
    if (!newSecret) return;

    await navigator.clipboard.writeText(newSecret);
  }

  return (
    <div>
      <button
        type="button"
        onClick={rotateSecret}
        disabled={isRotating}
        className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRotating ? "Rotating..." : "Rotate Secret"}
      </button>

      {newSecret && (
        <div className="mt-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
          <p className="text-xs font-medium text-yellow-900">
            Copy this secret now. It will not be shown again.
          </p>
          <code className="mt-2 block break-all rounded bg-white p-2 text-xs text-gray-800">
            {newSecret}
          </code>
          <button
            type="button"
            onClick={copySecret}
            className="mt-2 rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white"
          >
            Copy Secret
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
