"use client";

import { useState } from "react";

export default function PrivacyRequestForm() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(formData: FormData) {
    setIsSubmitting(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/privacy/public/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: String(formData.get("email") ?? ""),
          countryCode: String(formData.get("countryCode") ?? "91"),
          phoneNumber: String(formData.get("phoneNumber") ?? ""),
          intent: String(formData.get("intent") ?? "CONTACT_EXPORT"),
          reason: String(formData.get("reason") ?? "") || null,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to submit privacy request");
        return;
      }

      setMessage(data.message ?? "Please check your email.");
    } catch {
      setError("Unable to submit privacy request");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form action={submit} className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
      <div>
        <label className="text-sm font-medium text-gray-700">Email</label>
        <input
          name="email"
          type="email"
          required
          className="mt-1 w-full rounded-xl border px-4 py-2 text-sm"
          placeholder="you@example.com"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
        <div>
          <label className="text-sm font-medium text-gray-700">Country</label>
          <input
            name="countryCode"
            defaultValue="91"
            required
            className="mt-1 w-full rounded-xl border px-4 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">
            WhatsApp Phone Number
          </label>
          <input
            name="phoneNumber"
            required
            className="mt-1 w-full rounded-xl border px-4 py-2 text-sm"
            placeholder="8810386013"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700">Request Type</label>
        <select
          name="intent"
          className="mt-1 w-full rounded-xl border px-4 py-2 text-sm"
          defaultValue="CONTACT_EXPORT"
        >
          <option value="CONTACT_EXPORT">Export my data</option>
          <option value="CONTACT_DELETE">Delete/anonymize my data</option>
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700">Reason</label>
        <textarea
          name="reason"
          rows={4}
          className="mt-1 w-full rounded-xl border px-4 py-2 text-sm"
          placeholder="Optional"
        />
      </div>

      <button
        disabled={isSubmitting}
        className="w-full rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {isSubmitting ? "Submitting..." : "Submit Privacy Request"}
      </button>

      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
