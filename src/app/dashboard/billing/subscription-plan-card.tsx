"use client";

import type { BillingPlan } from "@/generated/prisma/client";
import { Check, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  type BillingPlanConfig,
  formatPlanPrice,
} from "@/server/config/billing-plans";

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

function loadCashfreeScript() {
  return new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://sdk.cashfree.com/js/v3/cashfree.js"]',
    );

    if (existing) {
      if (window.Cashfree) resolve(true);
      else existing.addEventListener("load", () => resolve(true), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function SubscriptionPlanCard({
  canManage,
  currentPlan,
  plan,
  renewal,
}: {
  canManage: boolean;
  currentPlan: BillingPlan;
  plan: BillingPlanConfig;
  renewal: {
    canRenew: boolean;
    isPastDue: boolean;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isChanging, setIsChanging] = useState(false);
  const isCurrent = currentPlan === plan.id;
  const isPaidPlan = plan.id !== "FREE";
  const isPastDue = isCurrent && isPaidPlan && renewal.isPastDue;
  const canRenewCurrentPlan =
    isCurrent && isPaidPlan && renewal.canRenew;
  const shouldDisableButton =
    !canManage || isChanging || (isCurrent && !canRenewCurrentPlan);

  async function chooseFreePlan() {
    if (!window.confirm("Change this workspace to the Free plan?")) return;

    setError("");
    setIsChanging(true);
    try {
      const response = await fetch("/api/billing/subscription/free", { method: "POST" });
      const data = (await response.json()) as { message: string };

      if (!response.ok) throw new Error(data.message);
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to change plan.");
    } finally {
      setIsChanging(false);
    }
  }

  async function payForPlan() {
    if (!window.confirm(`Continue to Cashfree for ${plan.name} at ${formatPlanPrice(plan.monthlyPricePaise)}?`)) return;

    setError("");
    setIsChanging(true);
    try {
      const loaded = await loadCashfreeScript();
      if (!loaded || !window.Cashfree) throw new Error("Unable to load Cashfree Checkout.");

      const orderResponse = await fetch("/api/billing/subscription/cashfree/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: plan.id }),
      });
      const orderData = (await orderResponse.json()) as {
        message: string;
        result?: {
          checkoutMode: "production" | "sandbox";
          order: {
            id: string;
            amount: number;
            currency: string;
            paymentSessionId: string;
          };
        };
      };

      if (!orderResponse.ok || !orderData.result) throw new Error(orderData.message);

      const cashfree = window.Cashfree({ mode: orderData.result.checkoutMode });
      const checkoutResult = await cashfree.checkout({
        paymentSessionId: orderData.result.order.paymentSessionId,
        redirectTarget: "_modal",
      });

      if (checkoutResult.error) {
        throw new Error(checkoutResult.error.message ?? "Cashfree payment failed.");
      }

      const verifyResponse = await fetch("/api/billing/subscription/cashfree/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cashfreeOrderId: orderData.result.order.id,
        }),
      });
      const verifyData = (await verifyResponse.json()) as { message: string };

      if (!verifyResponse.ok) throw new Error(verifyData.message);
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to start payment.");
    } finally {
      setIsChanging(false);
    }
  }

  return (
    <article className={`flex h-full flex-col rounded-2xl border bg-white p-4 shadow-[0_12px_30px_rgba(8,27,58,0.06)] ${isCurrent ? "border-[#0052CC] ring-2 ring-[#0052CC]/10" : "border-[#D8E6F3]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[#081B3A]">{plan.name}</h3>
          <p className="mt-1 text-xs leading-5 text-[#526173]">{plan.description}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {isCurrent ? (
            <span className="shrink-0 rounded-full bg-[#0052CC]/10 px-2.5 py-1 text-[11px] font-semibold text-[#0052CC]">Current</span>
          ) : null}
          {canRenewCurrentPlan ? (
            <span className="shrink-0 rounded-full bg-[#F8C830]/20 px-2.5 py-1 text-[11px] font-semibold text-[#7A5A00]">
              {isPastDue ? "Renew required" : "Expiring soon"}
            </span>
          ) : null}
        </div>
      </div>

      <p className="mt-4 text-2xl font-extrabold text-[#081B3A]">{formatPlanPrice(plan.monthlyPricePaise)}</p>
      <div className="mt-4 grid grid-cols-3 gap-2 border-y border-[#D8E6F3] py-3 text-center">
        <div><strong className="block text-sm text-[#102040]">{plan.monthlyMessageLimit.toLocaleString("en-IN")}</strong><span className="text-[10px] text-[#526173]">messages</span></div>
        <div><strong className="block text-sm text-[#102040]">{plan.maxBulkRecipients.toLocaleString("en-IN")}</strong><span className="text-[10px] text-[#526173]">bulk max</span></div>
        <div><strong className="block text-sm text-[#102040]">{plan.maxTeamMembers}</strong><span className="text-[10px] text-[#526173]">members</span></div>
      </div>
      <ul className="mt-3 flex-1 space-y-2 text-xs text-[#526173]">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#22C55E]" />{feature}</li>
        ))}
      </ul>
      <div className="mt-3 rounded-xl border border-[#D8E6F3] bg-[#F0F8FF] p-3">
        <p className="text-[10px] font-semibold uppercase text-[#2070B0]">
          Enabled product areas
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {plan.enabledFeatures.map((feature) => (
            <span key={feature} className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-[#526173] ring-1 ring-[#D8E6F3]">
              {feature.replaceAll("_", " ")}
            </span>
          ))}
        </div>
        <p className="mt-2 border-t border-[#D8E6F3] pt-2 text-[11px] text-[#526173]">
          <strong className="text-[#102040]">
            {plan.developerApiDailyLimit > 0
              ? plan.developerApiDailyLimit.toLocaleString("en-IN")
              : "No"}
          </strong>{" "}
          developer API requests/day
        </p>
      </div>
      {error ? <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">{error}</p> : null}
      <button
        type="button"
        disabled={shouldDisableButton}
        onClick={() => void (plan.id === "FREE" ? chooseFreePlan() : payForPlan())}
        className={`mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-55 ${isCurrent && !canRenewCurrentPlan ? "bg-[#F0F8FF] text-[#0052CC]" : "bg-[#0052CC] text-white hover:bg-[#003F9E]"}`}
      >
        {isChanging ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
        {isChanging
          ? "Processing..."
          : canRenewCurrentPlan
            ? isPastDue
              ? "Renew plan"
              : "Renew early"
            : isCurrent
              ? "Current plan"
              : plan.id === "FREE"
                ? "Choose Free"
                : "Pay and upgrade"}
      </button>
    </article>
  );
}
