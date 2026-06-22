"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEVELOPER_API_SCOPES } from "@/server/config/developer-api-scopes";

type EditApiKeyButtonProps = {
  apiKeyId: string;
  name: string;
  scopes: string[];
  allowedIps: string[];
  expiresAt: string | null;
  disabled?: boolean;
};

type UpdateApiKeyResponse = {
  message: string;
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

export default function EditApiKeyButton({
  apiKeyId,
  name,
  scopes,
  allowedIps,
  expiresAt,
  disabled = false,
}: EditApiKeyButtonProps) {
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftScopes, setDraftScopes] = useState<string[]>(scopes);
  const [allowedIpsText, setAllowedIpsText] = useState(allowedIps.join("\n"));
  const [draftExpiresAt, setDraftExpiresAt] = useState(
    expiresAt ? expiresAt.slice(0, 16) : "",
  );
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function toggleScope(scope: string) {
    setDraftScopes((current) =>
      current.includes(scope)
        ? current.filter((item) => item !== scope)
        : [...current, scope],
    );
  }

  function closeEditor() {
    setIsOpen(false);
    setDraftName(name);
    setDraftScopes(scopes);
    setAllowedIpsText(allowedIps.join("\n"));
    setDraftExpiresAt(expiresAt ? expiresAt.slice(0, 16) : "");
    setError("");
  }

  async function saveChanges() {
    setError("");
    setIsSaving(true);

    try {
      const response = await fetch(`/api/developer/api-keys/${apiKeyId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: draftName,
          scopes: draftScopes,
          allowedIps: parseAllowedIps(allowedIpsText),
          expiresAt: draftExpiresAt
            ? new Date(draftExpiresAt).toISOString()
            : null,
        }),
      });

      const data: UpdateApiKeyResponse = await response.json();

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

      setIsOpen(false);
      router.refresh();
    } catch {
      setError("Unable to update API key. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className="rounded-lg border border-[#D8E6F3] bg-white px-3 py-2 text-xs font-medium text-[#0052CC] disabled:cursor-not-allowed disabled:opacity-60"
      >
        Edit
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#081B3A]/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-[#D8E6F3] bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-[#081B3A]">
                  Edit API Key
                </h2>
                <p className="mt-1 text-sm text-[#526173]">
                  Update the label and permissions. The secret key will not be
                  changed.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditor}
                className="rounded-lg border border-[#D8E6F3] px-3 py-1 text-sm font-medium text-[#526173]"
              >
                Close
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor={`api-key-name-${apiKeyId}`}
                  className="mb-2 block text-sm font-medium text-[#102040]"
                >
                  API key name
                </label>
                <input
                  id={`api-key-name-${apiKeyId}`}
                  type="text"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  className="w-full rounded-lg border border-[#D8E6F3] px-4 py-3 text-[#102040] outline-none focus:border-[#0052CC]"
                />
              </div>

              <div>
                <p className="text-sm font-medium text-[#102040]">Scopes</p>
                <div className="mt-3 grid max-h-80 gap-3 overflow-y-auto md:grid-cols-2">
                  {DEVELOPER_API_SCOPES.map((scope) => (
                    <label
                      key={scope.id}
                      className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#D8E6F3] p-4"
                    >
                      <input
                        type="checkbox"
                        checked={draftScopes.includes(scope.id)}
                        onChange={() => toggleScope(scope.id)}
                        className="mt-1"
                      />

                      <span>
                        <span className="block text-sm font-medium text-[#102040]">
                          {scope.label}
                        </span>
                        <span className="mt-1 block text-xs text-[#526173]">
                          {scope.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#102040]">
                  Allowed IPs
                </label>

                <textarea
                  value={allowedIpsText}
                  onChange={(event) => setAllowedIpsText(event.target.value)}
                  rows={4}
                  placeholder={"Optional. One per line:\n103.10.20.30\n103.10.20.0/24"}
                  className="w-full rounded-lg border border-[#D8E6F3] px-4 py-2 text-sm text-[#102040] outline-none focus:border-[#0052CC]"
                />

                <p className="mt-2 text-xs text-[#526173]">
                  Leave empty to allow this key from any IP address.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#102040]">
                  Expires At
                </label>

                <input
                  type="datetime-local"
                  value={draftExpiresAt}
                  onChange={(event) => setDraftExpiresAt(event.target.value)}
                  className="w-full rounded-lg border border-[#D8E6F3] px-4 py-2 text-sm text-[#102040] outline-none focus:border-[#0052CC]"
                />

                <p className="mt-2 text-xs text-[#526173]">
                  Optional. Leave empty for no expiry.
                </p>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-lg border border-[#D8E6F3] px-4 py-2 text-sm font-semibold text-[#526173]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveChanges}
                disabled={isSaving}
                className="rounded-lg bg-[#0052CC] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
