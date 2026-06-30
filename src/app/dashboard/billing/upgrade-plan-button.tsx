"use client";

import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type CashfreeCheckoutResult = {
  error?: { message?: string };
  paymentDetails?: unknown;
  redirect?: boolean;
};

type CashfreeInstance = {
  checkout: (options: {
    paymentSessionId: string;
    redirectTarget?: "_modal" | "_self" | "_blank";
  }) => Promise<CashfreeCheckoutResult>;
};

declare global {
  interface Window {
    Cashfree?: (options: { mode: "production" | "sandbox" }) => CashfreeInstance;
  }
}

export function UpgradePlanButton({
  toPlan,
  label,
}: {
  toPlan: "STARTER" | "GROWTH" | "BUSINESS";
  label?: string;
}) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  async function loadCashfreeScript() {
    if (window.Cashfree) return true;

    return new Promise<boolean>((resolve) => {
      const script = document.createElement("script");
      script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  async function upgrade() {
    setIsCreating(true);
    setError("");

    try {
      const scriptLoaded = await loadCashfreeScript();

      if (!scriptLoaded) {
        setError("Unable to load Cashfree checkout.");
        return;
      }
      if (!window.Cashfree) {
        setError("Cashfree checkout is unavailable.");
        return;
      }

      const response = await fetch("/api/billing/plan-checkouts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          toPlan,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to create checkout.");
        return;
      }

      const checkoutId = data.checkout.id;
      if (!data.cashfree?.paymentSessionId || !data.cashfree?.orderId) {
        setError("Cashfree checkout details are missing.");
        return;
      }

      const cashfree = window.Cashfree({
        mode: data.cashfree.checkoutMode,
      });
      const checkoutResult = await cashfree.checkout({
        paymentSessionId: data.cashfree.paymentSessionId,
        redirectTarget: "_modal",
      });

      if (checkoutResult.error) {
        setError(checkoutResult.error.message ?? "Cashfree payment failed.");
        if (data.redirects?.cancel) {
          router.push(data.redirects.cancel);
        }
        return;
      }

      const verifyResponse = await fetch(
        `/api/billing/plan-checkouts/${checkoutId}/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cashfreeOrderId: data.cashfree.orderId,
          }),
        },
      );
      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok) {
        setError(verifyData.message ?? "Payment verification failed.");
        return;
      }

      router.push(data.redirects?.success ?? "/dashboard/billing");
      router.refresh();
    } catch {
      setError("Unable to start upgrade.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={upgrade}
        disabled={isCreating}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        <ArrowUpRight className="h-4 w-4" />
        {isCreating ? "Starting..." : label ?? `Upgrade to ${toPlan}`}
      </button>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
