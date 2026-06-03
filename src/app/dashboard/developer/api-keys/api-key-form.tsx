"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type CreateApiKeyResponse = {
  message: string;
  apiKey?: string;
  errors?: {
    name?: string[];
  };
};

export default function ApiKeyForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [rawApiKey, setRawApiKey] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setRawApiKey("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/developer/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
        }),
      });

      const data: CreateApiKeyResponse = await response.json();

      if (!response.ok) {
        const firstError = data.errors?.name?.[0] ?? data.message;
        setError(firstError);
        return;
      }

      setName("");
      setSuccess(data.message);
      setRawApiKey(data.apiKey ?? "");

      router.refresh();
    } catch {
      setError("Unable to create API key. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyApiKey() {
    if (!rawApiKey) {
      return;
    }

    await navigator.clipboard.writeText(rawApiKey);
    setSuccess("API key copied");
  }

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Create API Key</h2>

      <p className="mt-2 text-sm text-gray-600">
        API keys allow external apps to call your platform APIs.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label
            htmlFor="apiKeyName"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            API key name
          </label>

          <input
            id="apiKeyName"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Local Test Key"
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-black"
          />
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

        {rawApiKey && (
          <div className="rounded-lg border bg-yellow-50 p-4">
            <p className="text-sm font-semibold text-yellow-900">
              Copy this key now
            </p>

            <p className="mt-1 text-sm text-yellow-800">
              You will not be able to see this full key again.
            </p>

            <pre className="mt-4 overflow-x-auto rounded-lg bg-white p-3 text-xs text-gray-800">
              {rawApiKey}
            </pre>

            <button
              type="button"
              onClick={copyApiKey}
              className="mt-4 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
            >
              Copy API Key
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Creating..." : "Create API Key"}
        </button>
      </form>
    </div>
  );
}
