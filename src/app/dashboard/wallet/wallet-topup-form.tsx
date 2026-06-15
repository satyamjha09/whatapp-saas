"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  actionButtonClass,
  fieldClass,
  labelClass,
  Panel,
  PanelTitle,
} from "@/app/dashboard/dashboard-ui";

type TopUpWalletResponse = {
  message: string;
  errors?: {
    amountPaise?: string[];
    description?: string[];
  };
};

export default function WalletTopupForm() {
  const router = useRouter();

  const [amountRupees, setAmountRupees] = useState("");
  const [description, setDescription] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const amountNumber = Number(amountRupees);

      if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
        setError("Enter a valid amount");
        return;
      }

      const amountPaise = Math.round(amountNumber * 100);

      const response = await fetch("/api/wallet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amountPaise,
          description: description || "Manual wallet top-up",
        }),
      });

      const data: TopUpWalletResponse = await response.json();

      if (!response.ok) {
        const firstError =
          data.errors?.amountPaise?.[0] ??
          data.errors?.description?.[0] ??
          data.message;

        setError(firstError);
        return;
      }

      setAmountRupees("");
      setDescription("");
      setSuccess(data.message);

      router.refresh();
    } catch {
      setError("Unable to top up wallet. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Panel>
      <PanelTitle
        title="Manual top-up"
        description="Add test balance to this workspace wallet."
      />

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label htmlFor="amount" className={labelClass}>
            Amount in INR
          </label>

          <input
            id="amount"
            type="number"
            min="1"
            step="1"
            value={amountRupees}
            onChange={(event) => setAmountRupees(event.target.value)}
            placeholder="100"
            required
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="description" className={labelClass}>
            Description
          </label>

          <input
            id="description"
            type="text"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Initial test top-up"
            className={fieldClass}
          />
        </div>

        {error ? (
          <p className="rounded-xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-300">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-3 text-sm text-emerald-300">
            {success}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className={actionButtonClass()}
        >
          {isSubmitting ? "Adding balance..." : "Top Up Wallet"}
        </button>
      </form>
    </Panel>
  );
}
