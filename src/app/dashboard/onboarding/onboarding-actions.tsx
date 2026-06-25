"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CompanyOnboardingState } from "@/server/services/company-onboarding-state.service";

const businessCategories = [
  "Accounting",
  "Retail",
  "Wholesale",
  "Manufacturing",
  "Real Estate",
  "Education",
  "Healthcare",
  "Services",
  "Agency / Partner",
  "Other",
];

type ApiResponse = {
  ok?: boolean;
  message?: string;
  state?: CompanyOnboardingState;
  errors?: Record<string, string[] | undefined>;
};

function firstError(errors?: ApiResponse["errors"]) {
  return Object.values(errors ?? {}).flat().find(Boolean);
}

export function OnboardingActions({
  canManage,
  initialState,
}: {
  canManage: boolean;
  initialState: CompanyOnboardingState;
}) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [name, setName] = useState(initialState.company.name);
  const [businessCategory, setBusinessCategory] = useState(
    initialState.company.businessCategory ?? "",
  );
  const [city, setCity] = useState(initialState.company.city ?? "");
  const [pinCode, setPinCode] = useState(initialState.company.pinCode ?? "");
  const [employeeCode, setEmployeeCode] = useState(
    initialState.company.employeeCode ?? "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function saveProfile() {
    setError("");
    setMessage("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/company/onboarding", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          businessCategory,
          city,
          pinCode,
          employeeCode,
        }),
      });
      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.state) {
        setError(
          firstError(data.errors) ??
            data.message ??
            "Unable to save company profile.",
        );
        return;
      }

      setState(data.state);
      setMessage("Company profile saved.");
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  async function completeOnboarding() {
    setError("");
    setMessage("");
    setIsCompleting(true);

    try {
      const response = await fetch("/api/company/onboarding", {
        method: "POST",
      });
      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.state) {
        setError(data.message ?? "Unable to complete onboarding.");
        return;
      }

      setState(data.state);
      router.push("/dashboard");
      router.refresh();
    } finally {
      setIsCompleting(false);
    }
  }

  const canSaveProfile =
    canManage &&
    name.trim().length > 0 &&
    businessCategory.trim().length > 0 &&
    city.trim().length > 0 &&
    pinCode.trim().length > 0;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <section className="rounded-lg border border-[#D8E6F3] bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-semibold uppercase tracking-normal text-[#526173]">
            First setup
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[#081B3A]">
            Complete company onboarding
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#526173]">
            Review the required company details before this workspace becomes
            active.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[#102040]">
              Business name
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={!canManage}
              className="mt-1 w-full rounded-lg border border-[#D8E6F3] px-3 py-2 text-sm outline-none transition focus:border-[#0052CC] focus:ring-4 focus:ring-[#0052CC]/10 disabled:bg-gray-50"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[#102040]">
              Business category
            </span>
            <select
              value={businessCategory}
              onChange={(event) => setBusinessCategory(event.target.value)}
              disabled={!canManage}
              className="mt-1 w-full rounded-lg border border-[#D8E6F3] px-3 py-2 text-sm outline-none transition focus:border-[#0052CC] focus:ring-4 focus:ring-[#0052CC]/10 disabled:bg-gray-50"
            >
              <option value="">Select category</option>
              {businessCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[#102040]">City</span>
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              disabled={!canManage}
              className="mt-1 w-full rounded-lg border border-[#D8E6F3] px-3 py-2 text-sm outline-none transition focus:border-[#0052CC] focus:ring-4 focus:ring-[#0052CC]/10 disabled:bg-gray-50"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[#102040]">Pin code</span>
            <input
              value={pinCode}
              onChange={(event) => setPinCode(event.target.value)}
              disabled={!canManage}
              inputMode="numeric"
              className="mt-1 w-full rounded-lg border border-[#D8E6F3] px-3 py-2 text-sm outline-none transition focus:border-[#0052CC] focus:ring-4 focus:ring-[#0052CC]/10 disabled:bg-gray-50"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-[#102040]">
              Employee code
            </span>
            <input
              value={employeeCode}
              onChange={(event) => setEmployeeCode(event.target.value)}
              disabled={!canManage}
              className="mt-1 w-full rounded-lg border border-[#D8E6F3] px-3 py-2 text-sm outline-none transition focus:border-[#0052CC] focus:ring-4 focus:ring-[#0052CC]/10 disabled:bg-gray-50"
            />
          </label>
        </div>

        {!canManage ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Ask a workspace owner or admin to finish onboarding.
          </p>
        ) : null}

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        {message ? (
          <p className="mt-4 text-sm text-emerald-700">{message}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={saveProfile}
            disabled={!canSaveProfile || isSaving}
            className="rounded-lg bg-[#0052CC] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#003F9E] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save profile"}
          </button>

          <button
            type="button"
            onClick={completeOnboarding}
            disabled={!canManage || !state.requiredStepsComplete || isCompleting}
            className="rounded-lg border border-[#D8E6F3] bg-white px-4 py-2 text-sm font-semibold text-[#102040] transition hover:border-[#0052CC]/40 hover:bg-[#F0F8FF] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCompleting ? "Activating..." : "Activate workspace"}
          </button>
        </div>
      </section>

      <aside className="rounded-lg border border-[#D8E6F3] bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-[#081B3A]">
          Setup checklist
        </h2>
        <div className="mt-4 space-y-3">
          {state.steps.map((step) => (
            <div
              key={step.key}
              className="rounded-lg border border-[#D8E6F3] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#102040]">
                    {step.title}
                  </p>
                  <p className="mt-1 text-xs text-[#526173]">
                    {step.description}
                  </p>
                </div>
                <span
                  className={[
                    "shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold",
                    step.complete
                      ? "bg-emerald-50 text-emerald-700"
                      : step.required
                        ? "bg-amber-50 text-amber-700"
                        : "bg-gray-100 text-gray-600",
                  ].join(" ")}
                >
                  {step.complete
                    ? "Done"
                    : step.required
                      ? "Required"
                      : "Optional"}
                </span>
              </div>
              {step.href !== "/dashboard/onboarding" ? (
                <Link
                  href={step.href}
                  className="mt-3 inline-flex text-xs font-semibold text-[#0052CC] hover:text-[#003F9E]"
                >
                  Open setup
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
