"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type CreateCompanyResponse = {
  message: string;
  company?: {
    id: string;
    name: string;
  };
  errors?: {
    name?: string[];
  };
};

export default function OnboardingForm() {
  const router = useRouter();

  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/companies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: companyName,
        }),
      });

      const data: CreateCompanyResponse = await response.json();

      if (!response.ok) {
        const nameError = data.errors?.name?.[0];

        setError(nameError ?? data.message);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Unable to create company. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">
          Create your workspace
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          Enter your company name to get started.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="companyName"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Company name
            </label>

            <input
              id="companyName"
              name="companyName"
              type="text"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="company name"
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
            {isSubmitting ? "Creating workspace..." : "Create Workspace"}
          </button>
        </form>
      </div>
    </main>
  );
}
