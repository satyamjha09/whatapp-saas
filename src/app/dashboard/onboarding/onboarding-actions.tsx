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

function fieldStateClass(value: string, isRequired = false) {
  const isEmpty = value.trim().length === 0;

  if (isRequired && isEmpty) {
    return "border-rose-200 bg-rose-50/20 focus:border-rose-400 focus:ring-rose-500/10";
  }

  return "border-[#BFE9D0] bg-white focus:border-[#128C7E] focus:ring-[#128C7E]/10";
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
  const activateDisabledReason = state.requiredStepsComplete
    ? ""
    : "Complete company profile, WhatsApp connection, and billing setup before activating this workspace.";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="rounded-[22px] border border-[#9EDFC0] bg-white p-6 shadow-[0_18px_50px_rgba(8,27,58,0.08)] sm:p-8">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.08em] text-[#128C7E]">
            First setup
          </p>
          <h1 className="mt-4 text-2xl font-bold text-[#081B3A] md:text-3xl">
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
              Business name <span className="text-rose-500">*</span>
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={!canManage}
              className={[
                "mt-2 w-full rounded-xl border px-4 py-3 text-sm font-medium text-[#102040] outline-none transition focus:ring-4 disabled:bg-gray-50 disabled:text-gray-500",
                fieldStateClass(name, true),
              ].join(" ")}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[#102040]">
              Business category <span className="text-rose-500">*</span>
            </span>
            <select
              value={businessCategory}
              onChange={(event) => setBusinessCategory(event.target.value)}
              disabled={!canManage}
              className={[
                "mt-2 w-full rounded-xl border px-4 py-3 text-sm font-medium text-[#102040] outline-none transition focus:ring-4 disabled:bg-gray-50 disabled:text-gray-500",
                fieldStateClass(businessCategory, true),
              ].join(" ")}
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
            <span className="text-sm font-medium text-[#102040]">
              City <span className="text-rose-500">*</span>
            </span>
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              disabled={!canManage}
              className={[
                "mt-2 w-full rounded-xl border px-4 py-3 text-sm font-medium text-[#102040] outline-none transition focus:ring-4 disabled:bg-gray-50 disabled:text-gray-500",
                fieldStateClass(city, true),
              ].join(" ")}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[#102040]">
              Pin code <span className="text-rose-500">*</span>
            </span>
            <input
              value={pinCode}
              onChange={(event) => setPinCode(event.target.value)}
              disabled={!canManage}
              inputMode="numeric"
              className={[
                "mt-2 w-full rounded-xl border px-4 py-3 text-sm font-medium text-[#102040] outline-none transition focus:ring-4 disabled:bg-gray-50 disabled:text-gray-500",
                fieldStateClass(pinCode, true),
              ].join(" ")}
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
              className={[
                "mt-2 w-full rounded-xl border px-4 py-3 text-sm font-medium text-[#102040] outline-none transition focus:ring-4 disabled:bg-gray-50 disabled:text-gray-500",
                fieldStateClass(employeeCode),
              ].join(" ")}
            />
            <span className="mt-2 block text-xs text-[#60708A]">
              Optional - use this for your internal team, branch, or employee
              reference.
            </span>
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

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={saveProfile}
            disabled={!canSaveProfile || isSaving}
            className="rounded-xl bg-[#075E54] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(7,94,84,0.22)] transition hover:-translate-y-0.5 hover:bg-[#064C44] disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-[#8BCAC0] disabled:shadow-none"
          >
            {isSaving ? "Saving..." : "Save profile"}
          </button>

          <button
            type="button"
            onClick={completeOnboarding}
            title={activateDisabledReason || "Activate workspace"}
            disabled={!canManage || !state.requiredStepsComplete || isCompleting}
            className="rounded-xl border border-[#BFE9D0] bg-white px-5 py-3 text-sm font-semibold text-[#102040] transition hover:border-[#128C7E]/40 hover:bg-[#E7F8EF] disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-[#7C8798]"
          >
            {isCompleting ? "Activating..." : "Activate workspace"}
          </button>
        </div>
        {activateDisabledReason && canManage ? (
          <p className="mt-3 text-xs font-medium text-[#60708A]">
            {activateDisabledReason}
          </p>
        ) : null}
      </section>

      <aside className="rounded-[22px] border border-[#9EDFC0] bg-white p-5 shadow-[0_18px_50px_rgba(8,27,58,0.08)] sm:p-6">
        <h2 className="text-xl font-bold text-[#081B3A]">
          Setup checklist
        </h2>
        <div className="mt-5 divide-y divide-[#E1F3E9] overflow-hidden rounded-2xl border border-[#BFE9D0] bg-white">
          {state.steps.map((step) => (
            <div
              key={step.key}
              className="p-4 transition hover:bg-[#F4FBF7]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[#102040]">
                    {step.title}
                  </p>
                  <p className="mt-1 text-xs text-[#526173]">
                    {step.description}
                  </p>
                </div>
                <span
                  className={[
                    "shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ring-1",
                    step.complete
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      : step.required
                        ? "bg-orange-50 text-orange-700 ring-orange-200"
                        : "bg-gray-100 text-gray-600 ring-gray-200",
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
                  className="mt-3 inline-flex text-xs font-bold text-[#128C7E] hover:text-[#075E54]"
                >
                  {step.complete ? "View details" : "Open setup"}
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
