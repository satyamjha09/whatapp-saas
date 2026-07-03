"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type CompanySettingsFormProps = {
  approvalWorkflowAllowed: boolean;
  automationPublishApprovalRequired: boolean;
  companyName: string;
};

type UpdateCompanyResponse = {
  message: string;
  errors?: {
    automationPublishApprovalRequired?: string[];
    name?: string[];
  };
};

export default function CompanySettingsForm({
  approvalWorkflowAllowed,
  automationPublishApprovalRequired,
  companyName,
}: CompanySettingsFormProps) {
  const router = useRouter();

  const [approvalRequired, setApprovalRequired] = useState(
    automationPublishApprovalRequired,
  );
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
          automationPublishApprovalRequired: approvalRequired,
          name,
        }),
      });

      const data: UpdateCompanyResponse = await response.json();

      if (!response.ok) {
        const firstError =
          data.errors?.name?.[0] ??
          data.errors?.automationPublishApprovalRequired?.[0] ??
          data.message;
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

        {approvalWorkflowAllowed || automationPublishApprovalRequired ? (
          <label className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
            <input
              type="checkbox"
              checked={approvalRequired}
              disabled={!approvalWorkflowAllowed}
              onChange={(event) => setApprovalRequired(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
            />
            <span>
              <span className="block text-sm font-semibold text-gray-900">
                Require approval before publishing automations
              </span>
              <span className="mt-1 block text-sm text-gray-600">
                {approvalWorkflowAllowed
                  ? "When enabled, automation managers can request approval, but only owners/admins can approve and publish."
                  : "Your current plan does not include automation approval workflow. Existing approval history is kept, but new approval requests are disabled until you upgrade."}
              </span>
            </span>
          </label>
        ) : null}

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
