"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

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
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Manual Top-up</h2>

      <p className="mt-2 text-sm text-gray-600">
        Add test balance to this workspace wallet.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label
            htmlFor="amount"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
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
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-black"
          />
        </div>

        <div>
          <label
            htmlFor="description"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Description
          </label>

          <input
            id="description"
            type="text"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Initial test top-up"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-black"
          />
        </div>

        {error ? (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
            {success}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Adding balance..." : "Top Up Wallet"}
        </button>
      </form>
    </div>
  );
}
