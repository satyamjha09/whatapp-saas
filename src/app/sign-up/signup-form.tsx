"use client";

import { useSignUp } from "@clerk/nextjs/legacy";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  clearSignupCompanyDraft,
  saveSignupCompanyDraft,
} from "@/lib/signup-draft";

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

type FormState = {
  businessName: string;
  businessCategory: string;
  personalName: string;
  email: string;
  mobile: string;
  city: string;
  pinCode: string;
  employeeCode: string;
  whatsappUpdatesConsent: boolean;
  password: string;
  confirmPassword: string;
};

const initialForm: FormState = {
  businessName: "",
  businessCategory: "",
  personalName: "",
  email: "",
  mobile: "",
  city: "",
  pinCode: "",
  employeeCode: "",
  whatsappUpdatesConsent: true,
  password: "",
  confirmPassword: "",
};

function FieldLabel({
  children,
  required,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-2 block text-sm font-bold text-slate-950">
      {children} {required && <span className="text-red-500">*</span>}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  maxLength,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  maxLength?: number;
}) {
  return (
    <input
      type={type}
      value={value}
      maxLength={maxLength}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-5 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
    />
  );
}

type ApiResponse = {
  message?: string;
};

export function SignupForm({
  initialEmail = "",
  redirectUrl = "",
}: {
  initialEmail?: string;
  redirectUrl?: string;
}) {
  const router = useRouter();
  const { signUp, setActive, isLoaded } = useSignUp();
  const isInviteSignup = redirectUrl.startsWith("/invite/");

  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormState>({
    ...initialForm,
    email: initialEmail,
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canContinue = useMemo(() => {
    return (
      (isInviteSignup ||
        (form.businessName.trim().length >= 2 &&
          form.businessCategory.trim().length > 0 &&
          form.city.trim().length >= 2 &&
          /^\d{6}$/.test(form.pinCode) &&
          /^[6-9]\d{9}$/.test(form.mobile))) &&
      form.personalName.trim().length >= 2 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
    );
  }, [form, isInviteSignup]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function goToPasswordStep() {
    setError("");

    if (!canContinue) {
      setError("Please fill all required fields correctly.");
      return;
    }

    setStep(2);
  }

  async function createAccount() {
    setError("");

    if (!isLoaded || !signUp) {
      setError("Signup is not ready. Please try again.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Password and confirm password do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const companyDraft = {
        businessName: form.businessName,
        businessCategory: form.businessCategory,
        personalName: form.personalName,
        email: form.email,
        mobile: form.mobile,
        city: form.city,
        pinCode: form.pinCode,
        employeeCode: form.employeeCode || null,
        whatsappUpdatesConsent: form.whatsappUpdatesConsent,
      };

      if (isInviteSignup) {
        clearSignupCompanyDraft();
      } else {
        saveSignupCompanyDraft(companyDraft);
      }

      const createdSignUp = await signUp.create({
        emailAddress: form.email,
        password: form.password,
        firstName: form.personalName,
      });

      if (createdSignUp.status !== "complete") {
        await signUp.prepareEmailAddressVerification({
          strategy: "email_code",
        });

        const verifyUrl = redirectUrl
          ? `/verify-email?redirect_url=${encodeURIComponent(redirectUrl)}`
          : "/verify-email";
        router.push(verifyUrl);
        return;
      }

      await setActive({
        session: createdSignUp.createdSessionId,
      });

      if (isInviteSignup) {
        clearSignupCompanyDraft();
        router.push(redirectUrl);
        router.refresh();
        return;
      }

      const response = await fetch("/api/signup/company", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(companyDraft),
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        setError(data.message ?? "Unable to create company workspace.");
        return;
      }

      clearSignupCompanyDraft();

      router.push(redirectUrl || "/dashboard");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to create account.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mx-auto mb-8 flex max-w-md items-center justify-center gap-8">
        <div className="text-center">
          <div
            className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold ${
              step === 1
                ? "bg-blue-600 text-white"
                : "bg-blue-50 text-blue-700"
            }`}
          >
            1
          </div>
          <p
            className={`mt-2 text-sm font-bold ${
              step === 1 ? "text-blue-700" : "text-slate-500"
            }`}
          >
            Account details
          </p>
        </div>

        <div className="h-0.5 w-24 bg-slate-200" />

        <div className="text-center">
          <div
            className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold ${
              step === 2
                ? "bg-blue-600 text-white"
                : "bg-blue-50 text-slate-600"
            }`}
          >
            2
          </div>
          <p
            className={`mt-2 text-sm font-bold ${
              step === 2 ? "text-blue-700" : "text-slate-500"
            }`}
          >
            Set password
          </p>
        </div>
      </div>

      {step === 1 && (
        <div className="grid gap-5 md:grid-cols-2">
          {!isInviteSignup ? (
            <>
              <div>
                <FieldLabel required>Business Name</FieldLabel>
                <TextInput
                  value={form.businessName}
                  onChange={(value) => update("businessName", value)}
                  placeholder="Your Business"
                />
              </div>

              <div>
                <FieldLabel required>Business Category</FieldLabel>
                <select
                  value={form.businessCategory}
                  onChange={(event) =>
                    update("businessCategory", event.target.value)
                  }
                  className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-5 text-base text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">Please select</option>
                  {businessCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : null}

          <div className="md:col-span-2">
            <FieldLabel required>Personal Name</FieldLabel>
            <TextInput
              value={form.personalName}
              onChange={(value) => update("personalName", value)}
              placeholder="Your Name"
            />
          </div>

          <div>
            <FieldLabel required>Email</FieldLabel>
            <TextInput
              value={form.email}
              onChange={(value) => update("email", value.toLowerCase())}
              placeholder="your@email.com"
              type="email"
            />
          </div>

          {!isInviteSignup ? (
            <div>
              <FieldLabel required>Mobile</FieldLabel>
              <TextInput
                value={form.mobile}
                onChange={(value) =>
                  update("mobile", value.replace(/\D/g, "").slice(0, 10))
                }
                placeholder="10-digit mobile"
                maxLength={10}
              />
            </div>
          ) : null}

          {!isInviteSignup ? (
            <>
              <div>
                <FieldLabel required>City</FieldLabel>
                <TextInput
                  value={form.city}
                  onChange={(value) => update("city", value)}
                  placeholder="Your City"
                />
              </div>

              <div>
                <FieldLabel required>Pin Code</FieldLabel>
                <TextInput
                  value={form.pinCode}
                  onChange={(value) =>
                    update("pinCode", value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="6-digit PIN"
                  maxLength={6}
                />
              </div>

              <div className="md:col-span-2">
                <FieldLabel>Employee Code</FieldLabel>
                <TextInput
                  value={form.employeeCode}
                  onChange={(value) => update("employeeCode", value)}
                  placeholder="Employee code if any"
                />
              </div>

              <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="flex gap-3 text-sm font-medium leading-6 text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.whatsappUpdatesConsent}
                    onChange={(event) =>
                      update("whatsappUpdatesConsent", event.target.checked)
                    }
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  <span>
                    I agree to receive account, service, product, and
                    promotional updates from TallyKonnect on WhatsApp.
                  </span>
                </label>
              </div>
            </>
          ) : null}
        </div>
      )}

      {step === 2 && (
        <div className="mx-auto max-w-xl space-y-5">
          <div>
            <FieldLabel required>Password</FieldLabel>
            <TextInput
              value={form.password}
              onChange={(value) => update("password", value)}
              placeholder="Create password"
              type="password"
            />
          </div>

          <div>
            <FieldLabel required>Confirm Password</FieldLabel>
            <TextInput
              value={form.confirmPassword}
              onChange={(value) => update("confirmPassword", value)}
              placeholder="Confirm password"
              type="password"
            />
          </div>

          <button
            type="button"
            onClick={() => setStep(1)}
            className="text-sm font-semibold text-slate-600 underline"
          >
            Back to account details
          </button>
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="mt-8">
        {step === 1 ? (
          <button
            type="button"
            onClick={goToPasswordStep}
            disabled={!canContinue}
            className="h-14 w-full rounded-xl bg-blue-600 text-base font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={createAccount}
            disabled={isSubmitting}
            className="h-14 w-full rounded-xl bg-blue-600 text-base font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Creating account..." : "Create Account"}
          </button>
        )}
      </div>
    </div>
  );
}
