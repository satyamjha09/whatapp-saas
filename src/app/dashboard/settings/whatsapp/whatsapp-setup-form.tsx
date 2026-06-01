"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type WhatsAppAccount = {
  id: string;
  businessName: string | null;
  status: "PENDING" | "CONNECTED" | "DISCONNECTED" | "ERROR";
  wabaId: string | null;
};

type WhatsAppSetupFormProps = {
  initialAccount: WhatsAppAccount | null;
};

type CreateAccountResponse = {
  message: string;
  account?: WhatsAppAccount;
  errors?: {
    businessName?: string[];
  };
};

export default function WhatsAppSetupForm({
  initialAccount,
}: WhatsAppSetupFormProps) {
  const router = useRouter();

  const [businessName, setBusinessName] = useState("");
  const [account, setAccount] = useState<WhatsAppAccount | null>(
    initialAccount,
  );
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/whatsapp/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessName,
        }),
      });

      const data: CreateAccountResponse = await response.json();

      if (!response.ok) {
        const businessNameError = data.errors?.businessName?.[0];

        setError(businessNameError ?? data.message);
        return;
      }

      if (data.account) {
        setAccount(data.account);
      }

      router.refresh();
    } catch {
      setError("Unable to start WhatsApp setup. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (account) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          WhatsApp Business Account
        </h2>

        <div className="mt-6 space-y-4">
          <div className="rounded-xl border p-4">
            <p className="text-sm text-gray-500">Business Name</p>
            <p className="mt-1 font-medium text-gray-900">
              {account.businessName ?? "Not provided"}
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-sm text-gray-500">Connection Status</p>
            <p className="mt-1 font-medium text-gray-900">{account.status}</p>
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-sm text-gray-500">Meta WABA ID</p>
            <p className="mt-1 font-medium text-gray-900">
              {account.wabaId ?? "Not connected yet"}
            </p>
          </div>
        </div>

        {account.status === "PENDING" && (
          <p className="mt-6 rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
            Your WhatsApp setup has started. Meta connection will be added in
            the next module.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">
        Connect WhatsApp Business
      </h2>

      <p className="mt-2 text-sm text-gray-600">
        Start your WhatsApp Business setup for this workspace.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label
            htmlFor="businessName"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            WhatsApp business name
          </label>

          <input
            id="businessName"
            name="businessName"
            type="text"
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
            placeholder="Whizco"
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-black"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Starting setup..." : "Start WhatsApp Setup"}
        </button>
      </form>
    </div>
  );
}
