"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  actionButtonClass,
  fieldClass,
  labelClass,
  Panel,
  PanelTitle,
  StatusPill,
  statusTone,
} from "@/app/dashboard/dashboard-ui";

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
      <Panel>
        <PanelTitle
          title="WhatsApp Business Account"
          description="Stored WhatsApp account details for this workspace."
        />

        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
            <p className="text-sm text-zinc-500">Business Name</p>
            <p className="mt-1 font-medium text-white">
              {account.businessName ?? "Not provided"}
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
            <p className="text-sm text-zinc-500">Connection Status</p>
            <div className="mt-2">
              <StatusPill tone={statusTone(account.status)}>
                {account.status}
              </StatusPill>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
            <p className="text-sm text-zinc-500">Meta WABA ID</p>
            <p className="mt-1 font-medium text-white">
              {account.wabaId ?? "Not connected yet"}
            </p>
          </div>
        </div>

        {account.status === "PENDING" && (
          <p className="mt-6 rounded-xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-200">
            Your WhatsApp setup has started. Meta connection will be added in
            the next module.
          </p>
        )}
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelTitle
        title="Connect WhatsApp Business"
        description="Start your WhatsApp Business setup for this workspace."
      />

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label htmlFor="businessName" className={labelClass}>
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
            className={fieldClass}
          />
        </div>

        {error && (
          <p className="rounded-xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className={actionButtonClass()}
        >
          {isSubmitting ? "Starting setup..." : "Start WhatsApp Setup"}
        </button>
      </form>
    </Panel>
  );
}
