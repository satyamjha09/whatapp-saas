"use client";

import { CreditCard, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CreditPack } from "@/server/services/credit-purchase.service";
import { Panel, PanelTitle } from "@/app/dashboard/dashboard-ui";

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

function formatMoney(amountPaise: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    style: "currency",
    maximumFractionDigits: 0,
  }).format(amountPaise / 100);
}

export default function CreditPurchaseCheckout({
  cashfreeConfigured,
  packs,
}: {
  cashfreeConfigured: boolean;
  packs: CreditPack[];
}) {
  const router = useRouter();
  const [activePackId, setActivePackId] = useState<string | null>(null);
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

  async function buyCredits(packId: string) {
    setActivePackId(packId);
    setError("");

    try {
      if (!cashfreeConfigured) {
        setError("Payment gateway is not configured yet.");
        return;
      }

      const scriptLoaded = await loadCashfreeScript();

      if (!scriptLoaded || !window.Cashfree) {
        setError("Unable to load Cashfree checkout.");
        return;
      }

      const response = await fetch("/api/billing/credit-purchases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ packId }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to create credit checkout.");
        return;
      }

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
        return;
      }

      const verifyResponse = await fetch(
        `/api/billing/credit-purchases/${data.purchase.id}/verify`,
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

      router.refresh();
    } catch {
      setError("Unable to start credit checkout.");
    } finally {
      setActivePackId(null);
    }
  }

  return (
    <Panel>
      <PanelTitle
        title="Buy wallet credits"
        description="Add verified prepaid balance for WhatsApp message sending."
      />

      {!cashfreeConfigured ? (
        <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
          Cashfree checkout is not configured yet. Add production Cashfree
          credentials before customers can buy credits.
        </p>
      ) : null}

      <div className="mt-5 grid gap-3">
        {packs.map((pack) => {
          const isActive = activePackId === pack.id;

          return (
            <button
              key={pack.id}
              type="button"
              onClick={() => buyCredits(pack.id)}
              disabled={!cashfreeConfigured || Boolean(activePackId)}
              className="rounded-xl border border-emerald-200 bg-white p-4 text-left transition hover:border-emerald-400 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex items-start justify-between gap-3">
                <span>
                  <span className="block text-sm font-semibold text-slate-950">
                    {pack.label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    {pack.description}
                  </span>
                </span>

                <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-sm font-semibold text-emerald-700">
                  {formatMoney(pack.amountPaise)}
                </span>
              </span>

              <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                {isActive ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                {isActive ? "Opening checkout..." : "Buy credits"}
              </span>
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </Panel>
  );
}
