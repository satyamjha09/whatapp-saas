"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type CreateWebhookEndpointResponse = {
  message: string;
  signingSecret?: string;
  errors?: {
    name?: string[];
    url?: string[];
  };
};

export default function WebhookEndpointForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [signingSecret, setSigningSecret] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setSigningSecret("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/developer/webhooks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          url,
        }),
      });

      const data: CreateWebhookEndpointResponse = await response.json();

      if (!response.ok) {
        const firstError =
          data.errors?.name?.[0] ?? data.errors?.url?.[0] ?? data.message;

        setError(firstError);
        return;
      }

      setName("");
      setUrl("");
      setSuccess(data.message);
      setSigningSecret(data.signingSecret ?? "");

      router.refresh();
    } catch {
      setError("Unable to create webhook endpoint. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copySigningSecret() {
    if (!signingSecret) {
      return;
    }

    await navigator.clipboard.writeText(signingSecret);
    setSuccess("Signing secret copied");
  }

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">
        Create Webhook Endpoint
      </h2>

      <p className="mt-2 text-sm text-gray-600">
        Add a URL where your app will receive message status events.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label
            htmlFor="webhookName"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Webhook name
          </label>

          <input
            id="webhookName"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Production Webhook"
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-black"
          />
        </div>

        <div>
          <label
            htmlFor="webhookUrl"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Webhook URL
          </label>

          <input
            id="webhookUrl"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/webhooks/whatsapp"
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-black"
          />

          <p className="mt-1 text-xs text-gray-500">
            Use HTTPS in production. Localhost/ngrok is allowed for local tests.
          </p>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {success && (
          <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
            {success}
          </p>
        )}

        {signingSecret && (
          <div className="rounded-lg border bg-yellow-50 p-4">
            <p className="text-sm font-semibold text-yellow-900">
              Copy this signing secret now
            </p>

            <p className="mt-1 text-sm text-yellow-800">
              You will not be able to see this full secret again.
            </p>

            <pre className="mt-4 overflow-x-auto rounded-lg bg-white p-3 text-xs text-gray-800">
              {signingSecret}
            </pre>

            <button
              type="button"
              onClick={copySigningSecret}
              className="mt-4 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
            >
              Copy Signing Secret
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Creating..." : "Create Webhook Endpoint"}
        </button>
      </form>
    </div>
  );
}
