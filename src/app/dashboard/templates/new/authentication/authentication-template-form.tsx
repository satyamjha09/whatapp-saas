"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, KeyRound, Send } from "lucide-react";
import {
  actionButtonClass,
  fieldClass,
  helperTextClass,
  labelClass,
} from "@/app/dashboard/dashboard-ui";

type AuthenticationMode = "COPY_CODE" | "ONE_TAP" | "ZERO_TAP";
type CodeDeliveryMethod = "SMS" | "VOICE" | "WHATSAPP";

const languages = [
  { label: "English (US)", value: "en_US" },
  { label: "English", value: "en" },
  { label: "Hindi", value: "hi" },
];

function cleanTemplateName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildAuthenticationBody({
  expirationMinutes,
  securityRecommendation,
}: {
  expirationMinutes: string;
  securityRecommendation: boolean;
}) {
  const lines = ["{{1}} is your verification code."];

  if (securityRecommendation) {
    lines.push("For your security, do not share this code.");
  }

  if (expirationMinutes) {
    lines.push(`This code expires in ${expirationMinutes} minutes.`);
  }

  return lines.join("\n");
}

export default function AuthenticationTemplateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en_US");
  const [mode, setMode] = useState<AuthenticationMode>("COPY_CODE");
  const [deliveryMethod, setDeliveryMethod] =
    useState<CodeDeliveryMethod>("WHATSAPP");
  const [securityRecommendation, setSecurityRecommendation] = useState(true);
  const [expirationMinutes, setExpirationMinutes] = useState("10");
  const [ttlSeconds, setTtlSeconds] = useState("600");
  const [buttonText, setButtonText] = useState("Copy code");
  const [autofillText, setAutofillText] = useState("Autofill");
  const [androidPackageName, setAndroidPackageName] = useState("");
  const [androidSignatureHash, setAndroidSignatureHash] = useState("");
  const [sampleCode, setSampleCode] = useState("123456");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const body = useMemo(
    () =>
      buildAuthenticationBody({
        expirationMinutes,
        securityRecommendation,
      }),
    [expirationMinutes, securityRecommendation],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Template name is required.");
      return;
    }

    if (!sampleCode.trim()) {
      setError("Sample OTP code is required.");
      return;
    }

    if (mode !== "COPY_CODE") {
      if (!androidPackageName.trim()) {
        setError("Android package name is required for autofill templates.");
        return;
      }

      if (!androidSignatureHash.trim()) {
        setError("Android app signing hash is required for autofill templates.");
        return;
      }
    }

    setIsSubmitting(true);

    const buttons =
      mode === "COPY_CODE"
        ? [
            {
              example: sampleCode.trim(),
              text: buttonText.trim() || "Copy code",
              type: "COPY_CODE",
            },
          ]
        : [
            {
              autofillText: autofillText.trim() || "Autofill",
              packageName: androidPackageName.trim(),
              signatureHash: androidSignatureHash.trim(),
              text: autofillText.trim() || "Autofill",
              type: mode,
            },
          ];

    try {
      const response = await fetch("/api/templates", {
        body: JSON.stringify({
          body,
          category: "AUTHENTICATION",
          components: {
            authentication: {
              androidPackageName: androidPackageName.trim() || null,
              androidSignatureHash: androidSignatureHash.trim() || null,
              codeDeliveryMethod: deliveryMethod,
              expirationMinutes: Number(expirationMinutes),
              mode,
              securityRecommendation,
              ttlSeconds: Number(ttlSeconds),
            },
            components: [
              {
                example: {
                  body_text: [[sampleCode.trim()]],
                },
                text: body,
                type: "BODY",
              },
              {
                buttons,
                type: "BUTTONS",
              },
            ],
            templateType: "AUTHENTICATION",
          },
          language,
          name,
          templateType: "AUTHENTICATION",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as {
        errors?: Record<string, string[]>;
        message?: string;
      };

      if (!response.ok) {
        setError(
          data.errors?.name?.[0] ??
            data.errors?.components?.[0] ??
            data.message ??
            "Unable to create authentication template.",
        );
        return;
      }

      router.push("/dashboard/templates");
      router.refresh();
    } catch {
      setError("Unable to create authentication template. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]"
      onSubmit={handleSubmit}
    >
      <div className="space-y-6">
        <section className="overflow-hidden rounded-xl border border-[#BFE9D0] bg-white">
          <div className="border-b border-[#BFE9D0] px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-normal text-[#128C7E]">
              Authentication Template
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#081B3A]">
              OTP code delivery
            </h2>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Name</span>
              <input
                className={fieldClass}
                maxLength={80}
                onChange={(event) =>
                  setName(cleanTemplateName(event.target.value).slice(0, 80))
                }
                placeholder="login_otp"
                required
                value={name}
              />
              <p className={helperTextClass}>
                Lowercase letters, numbers, and underscores only.
              </p>
            </label>

            <label className="block">
              <span className={labelClass}>Language</span>
              <select
                className={fieldClass}
                onChange={(event) => setLanguage(event.target.value)}
                value={language}
              >
                {languages.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>Code delivery method</span>
              <select
                className={fieldClass}
                onChange={(event) =>
                  setDeliveryMethod(event.target.value as CodeDeliveryMethod)
                }
                value={deliveryMethod}
              >
                <option value="WHATSAPP">WhatsApp</option>
                <option value="SMS">SMS fallback</option>
                <option value="VOICE">Voice fallback</option>
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>Template variant</span>
              <select
                className={fieldClass}
                onChange={(event) =>
                  setMode(event.target.value as AuthenticationMode)
                }
                value={mode}
              >
                <option value="COPY_CODE">Copy Code</option>
                <option value="ONE_TAP">One-Tap Autofill</option>
                <option value="ZERO_TAP">Zero-Tap</option>
              </select>
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#BFE9D0] bg-white">
          <div className="border-b border-[#BFE9D0] px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-normal text-[#128C7E]">
              OTP Settings
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#081B3A]">
              Security, expiration and autofill
            </h2>
          </div>

          <div className="space-y-5 p-5">
            <label className="flex items-start gap-3 rounded-xl border border-[#BFE9D0] bg-[#F8FCFA] p-4">
              <input
                checked={securityRecommendation}
                className="mt-1 h-4 w-4"
                onChange={(event) =>
                  setSecurityRecommendation(event.target.checked)
                }
                type="checkbox"
              />
              <span>
                <span className="block text-sm font-bold text-[#081B3A]">
                  Add security recommendation
                </span>
                <span className="mt-1 block text-xs leading-5 text-[#526173]">
                  Adds a line warning customers not to share the code.
                </span>
              </span>
            </label>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className={labelClass}>Code expiration</span>
                <input
                  className={fieldClass}
                  min={1}
                  onChange={(event) => setExpirationMinutes(event.target.value)}
                  type="number"
                  value={expirationMinutes}
                />
                <p className={helperTextClass}>Minutes shown in message.</p>
              </label>
              <label className="block">
                <span className={labelClass}>TTL</span>
                <input
                  className={fieldClass}
                  min={60}
                  onChange={(event) => setTtlSeconds(event.target.value)}
                  type="number"
                  value={ttlSeconds}
                />
                <p className={helperTextClass}>Seconds for delivery validity.</p>
              </label>
              <label className="block">
                <span className={labelClass}>Sample OTP</span>
                <input
                  className={fieldClass}
                  maxLength={12}
                  onChange={(event) => setSampleCode(event.target.value)}
                  value={sampleCode}
                />
              </label>
            </div>

            {mode === "COPY_CODE" ? (
              <label className="block">
                <span className={labelClass}>Copy button text</span>
                <input
                  className={fieldClass}
                  maxLength={25}
                  onChange={(event) => setButtonText(event.target.value)}
                  value={buttonText}
                />
              </label>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <label className="block">
                  <span className={labelClass}>Autofill button text</span>
                  <input
                    className={fieldClass}
                    maxLength={25}
                    onChange={(event) => setAutofillText(event.target.value)}
                    value={autofillText}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Android package</span>
                  <input
                    className={fieldClass}
                    onChange={(event) =>
                      setAndroidPackageName(event.target.value)
                    }
                    placeholder="com.metawhat.app"
                    value={androidPackageName}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>App signing hash</span>
                  <input
                    className={fieldClass}
                    onChange={(event) =>
                      setAndroidSignatureHash(event.target.value)
                    }
                    placeholder="11-char hash"
                    value={androidSignatureHash}
                  />
                </label>
              </div>
            )}
          </div>
        </section>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        ) : null}

        <button
          className={actionButtonClass()}
          disabled={isSubmitting}
          type="submit"
        >
          <Send className="mr-2 h-4 w-4" />
          {isSubmitting ? "Saving..." : "Save Authentication Draft"}
        </button>
      </div>

      <aside className="xl:sticky xl:top-24 xl:self-start">
        <section className="overflow-hidden rounded-xl border border-[#BFE9D0] bg-white">
          <div className="border-b border-[#BFE9D0] px-5 py-4">
            <p className="text-sm font-bold text-[#081B3A]">WhatsApp Preview</p>
          </div>
          <div className="bg-[#eee7dd] bg-[radial-gradient(circle_at_12px_12px,rgba(120,110,100,0.13)_1px,transparent_1.5px),radial-gradient(circle_at_34px_28px,rgba(120,110,100,0.09)_1px,transparent_1.5px)] bg-[length:44px_44px] p-4">
            <div className="rounded-lg bg-white p-4 text-sm text-[#081B3A] shadow-sm">
              <div className="mb-3 grid h-20 place-items-center rounded-lg bg-[#E7F8EF] text-[#128C7E]">
                <KeyRound className="h-7 w-7" />
              </div>
              <p className="whitespace-pre-wrap leading-6">
                {body.replace("{{1}}", sampleCode || "{{1}}")}
              </p>
              <div className="mt-3 border-t border-[#DCEFE4] pt-2 text-center text-sm font-semibold text-[#128C7E]">
                {mode === "COPY_CODE" ? buttonText || "Copy code" : autofillText || "Autofill"}
              </div>
              <p className="mt-2 text-right text-xs text-[#526173]">10:13 PM</p>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-xl border border-[#BFE9D0] bg-[#F8FCFA] p-4 text-sm leading-6 text-[#526173]">
          {mode === "COPY_CODE" ? (
            <CheckCircle2 className="mb-2 h-5 w-5 text-[#128C7E]" />
          ) : (
            <AlertTriangle className="mb-2 h-5 w-5 text-amber-600" />
          )}
          {mode === "COPY_CODE"
            ? "Copy Code is the safest authentication template to start with."
            : "One-Tap and Zero-Tap require Android package and signing hash details before Meta review."}
        </section>
      </aside>
    </form>
  );
}
