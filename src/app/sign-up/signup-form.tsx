"use client";

import { useSignUp } from "@clerk/nextjs/legacy";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronDown,
  Grid3X3,
  Hash,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  ShieldCheck,
  User,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
  type ReactNode,
  type SVGProps,
} from "react";
import {
  clearSignupCompanyDraft,
  saveSignupCompanyDraft,
} from "@/lib/signup-draft";

const brand = {
  blue: "#128C7E",
  blueHover: "#075E54",
  border: "#BFE9D0",
  deepNavy: "#081B3A",
  lightBlue: "#E7F8EF",
  logoBlue: "#128C7E",
  muted: "#526173",
  text: "#102040",
  yellow: "#F8C830",
};

const businessCategories = [
  "Accounting Firm",
  "Chartered Accountant",
  "Retail Business",
  "Wholesale Business",
  "Manufacturing",
  "Distributor",
  "Service Business",
  "E-commerce",
  "Finance Team",
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
  channelPartner: string;
  employeeCode: string;
  whatsappUpdatesConsent: boolean;
  password: string;
  confirmPassword: string;
};

type FieldName = keyof FormState;
type FormErrors = Partial<Record<FieldName | "form", string>>;
type IconType = ComponentType<SVGProps<SVGSVGElement>>;

const initialForm: FormState = {
  businessName: "",
  businessCategory: "",
  personalName: "",
  email: "",
  mobile: "",
  city: "",
  pinCode: "",
  channelPartner: "",
  employeeCode: "",
  whatsappUpdatesConsent: true,
  password: "",
  confirmPassword: "",
};

type ApiResponse = {
  message?: string;
};

function fieldErrorId(name: FieldName) {
  return `${name}-error`;
}

function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative min-h-screen overflow-hidden px-4 py-8 text-[#102040] sm:px-6 lg:px-8"
      style={{ backgroundColor: brand.lightBlue }}
    >
      <div className="pointer-events-none absolute -left-24 top-8 h-72 w-72 rounded-full bg-[#128C7E]/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-8 h-80 w-80 rounded-full bg-[#075E54]/10 blur-3xl" />

      <div className="relative mx-auto max-w-[1180px]">
        <div className="mb-7 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-white shadow-[0_12px_30px_rgba(8,27,58,0.08)] ring-1 ring-[#BFE9D0]">
            <Image
              src="/brand/metawhat-mark.png"
              alt="metawhat logo"
              width={50}
              height={50}
              className="h-12 w-12 object-contain"
              priority
            />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-normal text-[#081B3A]">
            metawhat
          </h1>
          <p className="mt-1 text-sm font-medium text-[#526173]">
            Business Management Platform
          </p>
        </div>

        <div className="overflow-hidden rounded-[20px] border border-[#BFE9D0] bg-white shadow-[0_18px_50px_rgba(8,27,58,0.08)]">
          {children}
        </div>
      </div>
    </div>
  );
}

function BrandInformationPanel() {
  const benefits = [
    {
      icon: Building2,
      title: "Centralised business management",
    },
    {
      icon: ShieldCheck,
      title: "Secure role-based access",
    },
    {
      icon: BriefcaseBusiness,
      title: "Quick Tally and WhatsApp integration",
    },
  ];

  return (
    <aside className="relative overflow-hidden bg-gradient-to-br from-[#E7F8EF] via-white to-[#E7F8EF] p-6 sm:p-8 lg:w-[34%] lg:p-10">
      <div className="absolute right-6 top-8 h-32 w-32 rounded-full bg-[#128C7E]/10 blur-2xl" />
      <div className="relative">
        <span className="inline-flex rounded-full border border-[#BFE9D0] bg-white px-3 py-1 text-xs font-bold tracking-wide text-[#128C7E]">
          SUPER ADMIN SETUP
        </span>

        <h2 className="mt-6 text-3xl font-extrabold leading-tight text-[#081B3A] lg:text-4xl">
          Set up your metawhat workspace
        </h2>

        <p className="mt-4 text-sm leading-6 text-[#526173]">
          Create the primary administrator account for your organisation. You
          can invite team members and configure permissions after completing the
          setup.
        </p>

        <div className="mt-8 space-y-4">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;

            return (
              <div key={benefit.title} className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#BFE9D0] bg-white text-[#128C7E]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="text-sm font-semibold text-[#102040]">
                  {benefit.title}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-10 hidden rounded-2xl border border-[#BFE9D0] bg-white/75 p-5 lg:block">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-[#E7F8EF] p-3">
              <div className="h-2 w-14 rounded-full bg-[#128C7E]" />
              <div className="mt-3 h-10 rounded-lg bg-white" />
            </div>
            <div className="rounded-xl bg-[#E7F8EF] p-3">
              <div className="h-2 w-10 rounded-full bg-[#075E54]" />
              <div className="mt-3 h-10 rounded-lg bg-white" />
            </div>
            <div className="rounded-xl bg-[#E7F8EF] p-3">
              <div className="h-2 w-12 rounded-full bg-[#128C7E]" />
              <div className="mt-3 h-10 rounded-lg bg-white" />
            </div>
          </div>
          <div className="mt-4 h-2 w-3/4 rounded-full bg-[#BFE9D0]" />
          <div className="mt-3 h-2 w-1/2 rounded-full bg-[#BFE9D0]" />
        </div>

        <div className="mt-8 flex items-start gap-3 rounded-2xl border border-[#BFE9D0] bg-white p-4">
          <ShieldCheck
            className="mt-0.5 h-5 w-5 shrink-0 text-[#128C7E]"
            aria-hidden="true"
          />
          <p className="text-sm font-medium leading-6 text-[#526173]">
            Your business information is protected with secure encryption.
          </p>
        </div>
      </div>
    </aside>
  );
}

function OnboardingStepper({ step }: { step: 1 | 2 }) {
  const steps = [
    {
      id: 1,
      label: "Account details",
      description: "Business information",
    },
    {
      id: 2,
      label: "Set password",
      description: "Security credentials",
    },
  ] as const;

  return (
    <div className="mt-7" aria-label="Signup progress">
      <div className="grid grid-cols-[1fr_54px_1fr] items-start gap-3 sm:grid-cols-[1fr_96px_1fr]">
        {steps.map((item, index) => {
          const isActive = step === item.id;
          const isComplete = step > item.id;

          return (
            <div
              key={item.id}
              className={index === 0 ? "contents" : "contents"}
            >
              {index === 1 ? (
                <div className="mt-5 h-px bg-[#BFE9D0]">
                  <div
                    className="h-px bg-[#128C7E] transition-all duration-200"
                    style={{ width: step === 2 ? "100%" : "45%" }}
                  />
                </div>
              ) : null}

              <div
                aria-current={isActive ? "step" : undefined}
                className="min-w-0 text-center"
              >
                <div
                  className={`mx-auto flex h-11 w-11 items-center justify-center rounded-xl border text-sm font-bold transition ${
                    isActive || isComplete
                      ? "border-[#128C7E] bg-[#128C7E] text-white"
                      : "border-[#BFE9D0] bg-white text-[#526173]"
                  }`}
                >
                  {isComplete ? (
                    <Check className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    item.id
                  )}
                </div>
                <p
                  className={`mt-2 truncate text-sm font-bold ${
                    isActive ? "text-[#128C7E]" : "text-[#526173]"
                  }`}
                >
                  {item.label}
                </p>
                <p className="mt-1 text-xs font-medium text-[#526173]">
                  {item.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-[#D7F2E1] pt-6 first:border-t-0 first:pt-0">
      <div className="mb-4">
        <h3 className="text-[17px] font-bold text-[#081B3A]">{title}</h3>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-[#526173]">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function FormField({
  name,
  label,
  value,
  onChange,
  placeholder,
  icon: Icon,
  required,
  error,
  type = "text",
  inputMode,
  maxLength,
  autoComplete,
  prefix,
}: {
  name: FieldName;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon?: IconType;
  required?: boolean;
  error?: string;
  type?: string;
  inputMode?: "text" | "email" | "numeric" | "tel";
  maxLength?: number;
  autoComplete?: string;
  prefix?: ReactNode;
}) {
  const id = useId();
  const hasError = Boolean(error);

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-[#102040]">
        {label}{" "}
        {required ? (
          <span className="text-xs font-bold text-red-500" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      <div
        className={`flex h-14 items-center rounded-xl border bg-white px-4 transition duration-200 focus-within:ring-4 ${
          hasError
            ? "border-red-300 focus-within:border-red-400 focus-within:ring-red-100"
            : "border-[#BFE9D0] hover:border-[#8FD9AA] focus-within:border-[#128C7E] focus-within:ring-[rgba(18,140,126,0.14)]"
        }`}
      >
        {Icon ? (
          <Icon className="mr-3 h-5 w-5 shrink-0 text-[#526173]" aria-hidden="true" />
        ) : null}
        {prefix}
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          inputMode={inputMode}
          maxLength={maxLength}
          autoComplete={autoComplete}
          aria-invalid={hasError}
          aria-describedby={hasError ? fieldErrorId(name) : undefined}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-[#102040] outline-none placeholder:text-[#8A99AA]"
        />
        {hasError ? (
          <X className="ml-2 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
        ) : value ? (
          <Check className="ml-2 h-4 w-4 shrink-0 text-[#22C55E]" aria-hidden="true" />
        ) : null}
      </div>
      {hasError ? (
        <p
          id={fieldErrorId(name)}
          className="mt-2 text-sm font-medium text-red-600 motion-safe:animate-[fadeIn_160ms_ease-out]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SelectField({
  name,
  label,
  value,
  onChange,
  error,
  required,
}: {
  name: FieldName;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
}) {
  const id = useId();
  const searchId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const filteredOptions = businessCategories.filter((option) =>
    option.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const hasError = Boolean(error);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function selectOption(option: string) {
    onChange(option);
    setSearch("");
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) =>
        filteredOptions.length === 0
          ? 0
          : Math.min(current + 1, filteredOptions.length - 1),
      );
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open && filteredOptions[activeIndex]) {
        selectOption(filteredOptions[activeIndex]);
      } else {
        setOpen(true);
      }
    }

    if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-[#102040]">
        {label}{" "}
        {required ? (
          <span className="text-xs font-bold text-red-500" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      <button
        id={id}
        name={name}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-describedby={hasError ? fieldErrorId(name) : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
        className={`flex h-14 w-full items-center rounded-xl border bg-white px-4 text-left transition duration-200 focus:outline-none focus:ring-4 ${
          hasError
            ? "border-red-300 focus:border-red-400 focus:ring-red-100"
            : "border-[#BFE9D0] hover:border-[#8FD9AA] focus:border-[#128C7E] focus:ring-[rgba(18,140,126,0.14)]"
        }`}
      >
        <Grid3X3 className="mr-3 h-5 w-5 shrink-0 text-[#526173]" aria-hidden="true" />
        <span
          className={`min-w-0 flex-1 truncate text-[15px] font-medium ${
            value ? "text-[#102040]" : "text-[#8A99AA]"
          }`}
        >
          {value || "Please select"}
        </span>
        <ChevronDown className="ml-3 h-5 w-5 shrink-0 text-[#526173]" aria-hidden="true" />
      </button>

      {hasError ? (
        <p id={fieldErrorId(name)} className="mt-2 text-sm font-medium text-red-600">
          {error}
        </p>
      ) : null}

      {open ? (
        <div className="absolute z-20 mt-2 w-full rounded-xl border border-[#BFE9D0] bg-white p-2 shadow-[0_18px_40px_rgba(8,27,58,0.12)] motion-safe:animate-[dropdownIn_160ms_ease-out]">
          <div className="flex h-11 items-center rounded-lg border border-[#BFE9D0] px-3">
            <Search className="mr-2 h-4 w-4 text-[#526173]" aria-hidden="true" />
            <input
              id={searchId}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setActiveIndex(0);
              }}
              placeholder="Search category"
              className="min-w-0 flex-1 text-sm font-medium text-[#102040] outline-none placeholder:text-[#8A99AA]"
              autoFocus
            />
          </div>

          <div role="listbox" aria-labelledby={id} className="mt-2 max-h-64 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-4 text-sm font-medium text-[#526173]">
                No category found.
              </p>
            ) : (
              filteredOptions.map((option, index) => (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={value === option}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectOption(option)}
                  className={`flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${
                    index === activeIndex
                      ? "bg-[#E7F8EF] text-[#128C7E]"
                      : "text-[#102040] hover:bg-[#E7F8EF]"
                  }`}
                >
                  <span className="flex-1">{option}</span>
                  {value === option ? (
                    <Check className="h-4 w-4 text-[#128C7E]" aria-hidden="true" />
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ConsentCard({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#BFE9D0] bg-[#E7F8EF] p-4 transition hover:border-[#8FD9AA]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[#BFE9D0] bg-white text-white transition peer-checked:border-[#128C7E] peer-checked:bg-[#128C7E]">
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#526173]" aria-hidden="true" />
      <span className="text-sm font-medium leading-6 text-[#526173]">
        I agree to receive account, service, product and promotional updates
        from metawhat on WhatsApp.
      </span>
    </label>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  loading,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex h-[54px] w-full items-center justify-center gap-2 rounded-xl bg-[#128C7E] px-6 text-base font-semibold text-white shadow-[0_10px_22px_rgba(18,140,126,0.22)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#075E54] focus:outline-none focus:ring-4 focus:ring-[rgba(18,140,126,0.16)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 sm:w-auto sm:min-w-64 motion-reduce:hover:translate-y-0"
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" />
      ) : null}
      {children}
    </button>
  );
}

function validateAccountDetails(form: FormState, isInviteSignup: boolean) {
  const errors: FormErrors = {};

  if (!isInviteSignup) {
    if (form.businessName.trim().length === 0) {
      errors.businessName = "Business Name cannot be empty.";
    }

    if (!form.businessCategory) {
      errors.businessCategory = "Business Category must be selected.";
    }

    if (!/^[6-9]\d{9}$/.test(form.mobile)) {
      errors.mobile = "Enter a valid 10-digit mobile number.";
    }

    if (form.city.trim().length === 0) {
      errors.city = "City cannot be empty.";
    }

    if (!/^\d{6}$/.test(form.pinCode)) {
      errors.pinCode = "Pin Code must contain exactly 6 digits.";
    }
  }

  if (form.personalName.trim().length === 0) {
    errors.personalName = "Personal Name cannot be empty.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = "Enter a valid email address.";
  }

  return errors;
}

function firstErrorField(errors: FormErrors) {
  const order: FieldName[] = [
    "businessName",
    "businessCategory",
    "personalName",
    "email",
    "mobile",
    "city",
    "pinCode",
    "channelPartner",
    "employeeCode",
    "password",
    "confirmPassword",
  ];

  return order.find((name) => errors[name]);
}

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
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function focusFirstError(nextErrors: FormErrors) {
    const first = firstErrorField(nextErrors);

    if (!first) return;

    const node = document.querySelector<HTMLElement>(`[name="${first}"]`);
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => node?.focus(), 180);
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));

    setErrors((current) => ({
      ...current,
      [key]: undefined,
      form: undefined,
    }));
  }

  function goToPasswordStep() {
    const nextErrors = validateAccountDetails(form, isInviteSignup);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      focusFirstError(nextErrors);
      return;
    }

    setStep(2);
  }

  async function createAccount() {
    const accountErrors = validateAccountDetails(form, isInviteSignup);
    const nextErrors: FormErrors = { ...accountErrors };

    if (!isLoaded || !signUp || !setActive) {
      nextErrors.form = "Signup is not ready. Please try again.";
    }

    if (form.password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    }

    if (form.password !== form.confirmPassword) {
      nextErrors.confirmPassword = "Password and confirm password do not match.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      focusFirstError(nextErrors);
      return;
    }

    if (!signUp || !setActive) {
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
        channelPartner: form.channelPartner || null,
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
        setErrors({
          form: data.message ?? "Unable to create company workspace.",
        });
        return;
      }

      clearSignupCompanyDraft();

      router.push(redirectUrl || "/dashboard");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to create account.";
      setErrors({ form: message });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <OnboardingLayout>
      <div className="flex flex-col lg:flex-row">
        <BrandInformationPanel />

        <section className="p-6 sm:p-8 lg:w-[66%] lg:p-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold tracking-wide text-[#128C7E]">
                GETTING STARTED
              </p>
              <h2 className="mt-2 text-2xl font-extrabold text-[#081B3A] sm:text-3xl">
                Create your administrator account
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#526173]">
                Enter your business and contact details to continue.
              </p>
            </div>

            <span className="inline-flex w-fit rounded-full border border-[#BFE9D0] bg-[#E7F8EF] px-3 py-1 text-sm font-semibold text-[#526173]">
              Step {step} of 2
            </span>
          </div>

          <OnboardingStepper step={step} />

          <div aria-live="polite" className="mt-6">
            {errors.form ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {errors.form}
              </div>
            ) : null}
          </div>

          <div className="mt-8 space-y-8">
            {step === 1 ? (
              <>
                {!isInviteSignup ? (
                  <FormSection
                    title="Business information"
                    description="Tell us about the organisation using metawhat."
                  >
                    <div className="grid gap-5 md:grid-cols-2">
                      <FormField
                        name="businessName"
                        label="Business Name"
                        value={form.businessName}
                        onChange={(value) => update("businessName", value)}
                        placeholder="Your Business"
                        icon={Building2}
                        required
                        error={errors.businessName}
                        autoComplete="organization"
                      />

                      <SelectField
                        name="businessCategory"
                        label="Business Category"
                        value={form.businessCategory}
                        onChange={(value) => update("businessCategory", value)}
                        error={errors.businessCategory}
                        required
                      />
                    </div>
                  </FormSection>
                ) : null}

                <FormSection
                  title="Primary administrator"
                  description="This person will receive the main administrator access."
                >
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <FormField
                        name="personalName"
                        label="Personal Name"
                        value={form.personalName}
                        onChange={(value) => update("personalName", value)}
                        placeholder="Your Name"
                        icon={User}
                        required
                        error={errors.personalName}
                        autoComplete="name"
                      />
                    </div>

                    <FormField
                      name="email"
                      label="Email"
                      value={form.email}
                      onChange={(value) => update("email", value.toLowerCase())}
                      placeholder="your@email.com"
                      icon={Mail}
                      required
                      error={errors.email}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                    />

                    {!isInviteSignup ? (
                      <FormField
                        name="mobile"
                        label="Mobile"
                        value={form.mobile}
                        onChange={(value) =>
                          update("mobile", value.replace(/\D/g, "").slice(0, 10))
                        }
                        placeholder="10-digit mobile"
                        icon={Phone}
                        required
                        error={errors.mobile}
                        inputMode="numeric"
                        maxLength={10}
                        autoComplete="tel-national"
                        prefix={
                          <span className="mr-3 rounded-lg border border-[#BFE9D0] bg-[#E7F8EF] px-2 py-1 text-sm font-semibold text-[#526173]">
                            +91
                          </span>
                        }
                      />
                    ) : null}
                  </div>
                </FormSection>

                {!isInviteSignup ? (
                  <>
                    <FormSection title="Business location">
                      <div className="grid gap-5 md:grid-cols-2">
                        <FormField
                          name="city"
                          label="City"
                          value={form.city}
                          onChange={(value) => update("city", value)}
                          placeholder="Your City"
                          icon={MapPin}
                          required
                          error={errors.city}
                          autoComplete="address-level2"
                        />

                        <FormField
                          name="pinCode"
                          label="Pin Code"
                          value={form.pinCode}
                          onChange={(value) =>
                            update(
                              "pinCode",
                              value.replace(/\D/g, "").slice(0, 6),
                            )
                          }
                          placeholder="6-digit PIN"
                          icon={Hash}
                          required
                          error={errors.pinCode}
                          inputMode="numeric"
                          maxLength={6}
                          autoComplete="postal-code"
                        />
                      </div>
                    </FormSection>

                    <FormSection
                      title="Referral information"
                      description="Optional information for partner or employee referrals."
                    >
                      <div className="grid gap-5 md:grid-cols-2">
                        <FormField
                          name="channelPartner"
                          label="Channel Partner"
                          value={form.channelPartner}
                          onChange={(value) => update("channelPartner", value)}
                          placeholder="Partner name if any"
                          icon={Users}
                          error={errors.channelPartner}
                        />

                        <FormField
                          name="employeeCode"
                          label="Employee Code"
                          value={form.employeeCode}
                          onChange={(value) => update("employeeCode", value)}
                          placeholder="Employee code if any"
                          icon={BadgeCheck}
                          error={errors.employeeCode}
                        />
                      </div>

                      <div className="mt-5">
                        <ConsentCard
                          checked={form.whatsappUpdatesConsent}
                          onChange={(checked) =>
                            update("whatsappUpdatesConsent", checked)
                          }
                        />
                      </div>
                    </FormSection>
                  </>
                ) : null}
              </>
            ) : (
              <FormSection
                title="Set password"
                description="Create a secure password for the administrator account."
              >
                <div className="mx-auto grid max-w-2xl gap-5">
                  <FormField
                    name="password"
                    label="Password"
                    value={form.password}
                    onChange={(value) => update("password", value)}
                    placeholder="Create password"
                    icon={Lock}
                    required
                    error={errors.password}
                    type="password"
                    autoComplete="new-password"
                  />

                  <FormField
                    name="confirmPassword"
                    label="Confirm Password"
                    value={form.confirmPassword}
                    onChange={(value) => update("confirmPassword", value)}
                    placeholder="Confirm password"
                    icon={Lock}
                    required
                    error={errors.confirmPassword}
                    type="password"
                    autoComplete="new-password"
                  />
                </div>
              </FormSection>
            )}
          </div>

          <div className="mt-8 flex flex-col-reverse gap-4 border-t border-[#D7F2E1] pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {step === 2 ? (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#526173] transition hover:text-[#128C7E] focus:outline-none focus:ring-4 focus:ring-[rgba(18,140,126,0.14)]"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back to account details
                </button>
              ) : (
                <p className="flex items-start gap-2 text-sm leading-6 text-[#526173]">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  Your information is securely stored and never shared without
                  permission.
                </p>
              )}
            </div>

            {step === 1 ? (
              <PrimaryButton onClick={goToPasswordStep}>
                Continue to Set Password
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </PrimaryButton>
            ) : (
              <PrimaryButton
                onClick={createAccount}
                disabled={isSubmitting}
                loading={isSubmitting}
              >
                {isSubmitting ? "Saving details..." : "Create Account"}
                {!isSubmitting ? (
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                ) : null}
              </PrimaryButton>
            )}
          </div>

          <p className="mt-5 text-center text-sm font-medium text-[#526173] sm:text-right">
            Already have an account?{" "}
            <Link
              href="/sign-in"
              className="font-semibold text-[#128C7E] hover:text-[#075E54]"
            >
              Sign in
            </Link>
          </p>
        </section>
      </div>
    </OnboardingLayout>
  );
}
