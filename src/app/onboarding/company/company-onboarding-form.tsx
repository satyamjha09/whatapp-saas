"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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

type SignupResponse = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

export function CompanyOnboardingForm({
  defaultEmail,
  defaultMobile,
  defaultPersonalName,
}: {
  defaultEmail: string;
  defaultMobile?: string;
  defaultPersonalName?: string;
}) {
  const router = useRouter();

  const [businessName, setBusinessName] = useState("");
  const [businessCategory, setBusinessCategory] = useState("");
  const [personalName, setPersonalName] = useState(defaultPersonalName ?? "");
  const [email, setEmail] = useState(defaultEmail);
  const [mobile, setMobile] = useState(defaultMobile ?? "");
  const [city, setCity] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [whatsappUpdatesConsent, setWhatsappUpdatesConsent] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function firstError(errors?: SignupResponse["errors"]) {
    return Object.values(errors ?? {}).flat().find(Boolean);
  }

  async function createCompany() {
    setError("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/signup/company", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessName,
          businessCategory,
          personalName,
          email,
          mobile,
          city,
          pinCode,
          employeeCode,
          whatsappUpdatesConsent,
        }),
      });

      const data = (await response.json()) as SignupResponse;

      if (!response.ok) {
        setError(firstError(data.errors) ?? data.message ?? "Unable to create workspace.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Business Name *
          </span>
          <input
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
            placeholder="Example: Maya Krishna Sales"
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Business Category *
          </span>
          <select
            value={businessCategory}
            onChange={(event) => setBusinessCategory(event.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
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
          <span className="text-sm font-medium text-gray-700">
            Personal Name *
          </span>
          <input
            value={personalName}
            onChange={(event) => setPersonalName(event.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Email *</span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Mobile *</span>
          <input
            value={mobile}
            onChange={(event) => setMobile(event.target.value)}
            inputMode="numeric"
            maxLength={10}
            placeholder="9876543210"
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">City *</span>
          <input
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Pin Code *</span>
          <input
            value={pinCode}
            onChange={(event) => setPinCode(event.target.value)}
            inputMode="numeric"
            maxLength={6}
            placeholder="110001"
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Employee Code
          </span>
          <input
            value={employeeCode}
            onChange={(event) => setEmployeeCode(event.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="mt-5 flex items-start gap-3 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={whatsappUpdatesConsent}
          onChange={(event) => setWhatsappUpdatesConsent(event.target.checked)}
          className="mt-1"
        />
        <span>I agree to receive WhatsApp updates.</span>
      </label>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={createCompany}
        disabled={
          isSaving ||
          !businessName.trim() ||
          !businessCategory ||
          !personalName.trim() ||
          !email.trim() ||
          !mobile.trim() ||
          !city.trim() ||
          !pinCode.trim()
        }
        className="mt-6 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isSaving ? "Creating..." : "Create Workspace"}
      </button>
    </section>
  );
}
