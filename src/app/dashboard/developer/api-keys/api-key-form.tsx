"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_DEVELOPER_API_SCOPES,
  DEVELOPER_API_SCOPES,
} from "@/server/config/developer-api-scopes";

type CreateApiKeyResponse = {
  message: string;
  apiKey?: string;
  errors?: {
    name?: string[];
    scopes?: string[];
    allowedIps?: string[];
    expiresAt?: string[];
  };
};

function parseAllowedIps(text: string) {
  return text
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ApiKeyForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [rawApiKey, setRawApiKey] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(
    DEFAULT_DEVELOPER_API_SCOPES,
  );
  const [allowedIpsText, setAllowedIpsText] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
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
          scopes: selectedScopes,
          allowedIps: parseAllowedIps(allowedIpsText),
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      });

      const data: CreateApiKeyResponse = await response.json();

      if (!response.ok) {
        const firstError =
          data.errors?.name?.[0] ??
          data.errors?.scopes?.[0] ??
          data.errors?.allowedIps?.[0] ??
          data.errors?.expiresAt?.[0] ??
          data.message;
        setError(firstError);
        return;
      }

      setName("");
      setAllowedIpsText("");
      setExpiresAt("");
      setSuccess(data.message);
      setRawApiKey(data.apiKey ?? "");

      router.refresh();
    } catch {
      setError("Unable to create API key. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleScope(scope: string) {
    setSelectedScopes((current) =>
      current.includes(scope)
        ? current.filter((item) => item !== scope)
        : [...current, scope],
    );
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

        <div>
          <p className="text-sm font-medium text-gray-900">Scopes</p>
          <p className="mt-1 text-xs text-gray-500">
            Select only the permissions this integration needs.
          </p>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {DEVELOPER_API_SCOPES.map((scope) => (
              <label
                key={scope.id}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-4"
              >
                <input
                  type="checkbox"
                  checked={selectedScopes.includes(scope.id)}
                  onChange={() => toggleScope(scope.id)}
                  className="mt-1"
                />

                <span>
                  <span className="block text-sm font-medium text-gray-900">
                    {scope.label}
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">
                    {scope.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Allowed IPs
          </label>

          <textarea
            value={allowedIpsText}
            onChange={(event) => setAllowedIpsText(event.target.value)}
            rows={4}
            placeholder={"Optional. One per line:\n103.10.20.30\n103.10.20.0/24"}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 outline-none focus:border-black"
          />

          <p className="mt-2 text-xs text-gray-500">
            Leave empty to allow this key from any IP address.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Expires At
          </label>

          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 outline-none focus:border-black"
          />

          <p className="mt-2 text-xs text-gray-500">
            Optional. Leave empty for no expiry.
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
