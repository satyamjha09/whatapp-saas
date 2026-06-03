"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type CompanySettingsFormProps = {
  companyName: string;
};

type UpdateCompanyResponse = {
  message: string;
  errors?: {
    name?: string[];
  };
};

export default function CompanySettingsForm({
  companyName,
}: CompanySettingsFormProps) {
  const router = useRouter();

  const [name, setName] = useState(companyName);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/company", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
        }),
      });

      const data: UpdateCompanyResponse = await response.json();

      if (!response.ok) {
        const firstError = data.errors?.name?.[0] ?? data.message;
        setError(firstError);
        return;
      }

      setSuccess(data.message);
      router.refresh();
    } catch {
      setError("Unable to update company. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">
        Workspace Details
      </h2>

      <p className="mt-2 text-sm text-gray-600">
        Update your company/workspace name.
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
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
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
          className="rounded-lg bg-black px-5 py-3 font-medium text-white disabled:opacity-60"
        >
          {isSubmitting ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
