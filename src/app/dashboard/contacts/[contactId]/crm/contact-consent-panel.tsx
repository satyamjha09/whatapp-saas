"use client";

import { Check, LoaderCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ContactConsentPanel({
  contactId,
  marketingConsentStatus,
  utilityConsentStatus,
}: {
  contactId: string;
  marketingConsentStatus: string;
  utilityConsentStatus: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function recordConsent(type: string, status: string) {
    setIsSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/contacts/${contactId}/consent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          status,
          source: "DASHBOARD",
          evidenceText: `Admin manually set ${type} to ${status}`,
        }),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(data.message ?? "Unable to update consent");
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to update consent");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500">Consent</p>
          <h2 className="mt-1 text-lg font-semibold text-gray-900">
            WhatsApp Permissions
          </h2>
        </div>

        {isSaving ? (
          <LoaderCircle className="h-5 w-5 animate-spin text-gray-500" />
        ) : null}
      </div>

      <div className="mt-4 space-y-4">
        {[
          {
            label: "Marketing",
            type: "WHATSAPP_MARKETING",
            status: marketingConsentStatus,
          },
          {
            label: "Utility",
            type: "WHATSAPP_UTILITY",
            status: utilityConsentStatus,
          },
        ].map((item) => (
          <div key={item.type} className="rounded-xl bg-gray-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">{item.label} Consent</p>
                <p className="mt-1 font-semibold text-gray-900">
                  {item.status}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => recordConsent(item.type, "GRANTED")}
                  className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                >
                  <Check className="h-3.5 w-3.5" />
                  Grant
                </button>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => recordConsent(item.type, "REVOKED")}
                  className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                >
                  <X className="h-3.5 w-3.5" />
                  Revoke
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
