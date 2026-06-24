"use client";

import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

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

  async function loadRazorpayScript() {
    if (window.Razorpay) return true;

    return new Promise<boolean>((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  async function upgrade() {
    setIsCreating(true);
    setError("");

    try {
      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded) {
        setError("Unable to load Razorpay checkout.");
        return;
      }
      if (!window.Razorpay) {
        setError("Razorpay checkout is unavailable.");
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
      const razorpay = new window.Razorpay!({
        key: data.razorpay.keyId,
        amount: data.razorpay.amountPaise,
        currency: data.razorpay.currency,
        name: "TallyKonnect",
        description: `${toPlan} plan upgrade`,
        order_id: data.razorpay.orderId,
        theme: { color: "#111827" },
        handler: async (payment: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const verifyResponse = await fetch(
            `/api/billing/plan-checkouts/${checkoutId}/verify`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                razorpayOrderId: payment.razorpay_order_id,
                razorpayPaymentId: payment.razorpay_payment_id,
                razorpaySignature: payment.razorpay_signature,
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
        },
        modal: {
          ondismiss: () => {
            if (data.redirects?.cancel) {
              router.push(data.redirects.cancel);
            }
            setIsCreating(false);
          },
        },
      });

      razorpay.open();
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
