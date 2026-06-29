"use client";

import { FormEvent, useState } from "react";

export default function SendTestFlowForm({ flowId }: { flowId: string }) {
  const [countryCode, setCountryCode] = useState("91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setIsSending(true);

    try {
      const response = await fetch(`/api/whatsapp-flows/${flowId}/send-test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          countryCode,
          phoneNumber,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? "Unable to queue test Flow");
      }

      setMessage("Test Flow queued successfully.");
      setPhoneNumber("");
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Unable to queue test Flow",
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[110px_1fr]">
        <div>
          <label htmlFor="testCountryCode" className="mb-2 block text-sm font-semibold text-[#081B3A]">
            Code
          </label>
          <input
            id="testCountryCode"
            value={countryCode}
            onChange={(event) => setCountryCode(event.target.value)}
            className="w-full rounded-lg border border-[#D8E6F3] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="testPhoneNumber" className="mb-2 block text-sm font-semibold text-[#081B3A]">
            Phone number
          </label>
          <input
            id="testPhoneNumber"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            required
            className="w-full rounded-lg border border-[#D8E6F3] px-3 py-2 text-sm"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isSending}
        className="rounded-lg bg-[#0052CC] px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-300"
      >
        {isSending ? "Queueing..." : "Send test Flow"}
      </button>

      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </form>
  );
}
