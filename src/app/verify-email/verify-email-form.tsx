"use client";

import { useSignUp } from "@clerk/nextjs/legacy";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  clearSignupCompanyDraft,
  getSignupCompanyDraft,
} from "@/lib/signup-draft";

type ApiResponse = {
  message?: string;
};

export function VerifyEmailForm({ redirectUrl = "" }: { redirectUrl?: string }) {
  const router = useRouter();
  const { signUp, setActive, isLoaded } = useSignUp();
  const isInviteSignup = redirectUrl.startsWith("/invite/");

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  async function verify() {
    if (!isLoaded || !signUp) return;

    setError("");
    setIsVerifying(true);

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (result.status !== "complete") {
        setError("Verification is not complete.");
        return;
      }

      await setActive({
        session: result.createdSessionId,
      });

      if (isInviteSignup) {
        clearSignupCompanyDraft();
        router.push(redirectUrl);
        router.refresh();
        return;
      }

      const draft = getSignupCompanyDraft();

      if (!draft) {
        router.push("/onboarding/company");
        router.refresh();
        return;
      }

      const response = await fetch("/api/signup/company", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        setError(
          data.message ??
            "Email verified, but company workspace was not created.",
        );
        return;
      }

      clearSignupCompanyDraft();

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Invalid verification code.";
      setError(message);
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-950">Verify your email</h1>
      <p className="mt-2 text-sm text-slate-600">
        Enter the verification code sent to your email.
      </p>

      <input
        value={code}
        onChange={(event) => setCode(event.target.value)}
        placeholder="Verification code"
        className="mt-6 h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-5 text-base outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
      />

      {error && (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={verify}
        disabled={isVerifying || !code.trim()}
        className="mt-6 h-14 w-full rounded-xl bg-emerald-600 text-base font-bold text-white disabled:opacity-50"
      >
        {isVerifying ? "Verifying..." : "Verify Email"}
      </button>
    </div>
  );
}
