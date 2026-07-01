"use client";

import { CheckCircle2, LoaderCircle, Webhook } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { actionButtonClass } from "@/app/dashboard/dashboard-ui";

type SubscribeResponse = {
  message?: string;
};

export default function SubscribeWebhooksButton({
  canManage,
  isConnected,
}: {
  canManage: boolean;
  isConnected: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);

  async function subscribeWebhooks() {
    setError("");
    setSuccess("");
    setIsSubscribing(true);

    try {
      const response = await fetch("/api/whatsapp/webhooks/subscribe", {
        method: "POST",
      });
      const data = (await response.json()) as SubscribeResponse;

      if (!response.ok) {
        setError(data.message ?? "Unable to subscribe webhooks.");
        return;
      }

      setSuccess(data.message ?? "Webhook subscription completed.");
      router.refresh();
    } catch {
      setError("Unable to subscribe webhooks.");
    } finally {
      setIsSubscribing(false);
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_16px_40px_rgba(8,27,58,0.08)] sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#E7F8EF] text-[#128C7E]">
            <Webhook className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#081B3A]">
              Webhook Subscription
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[#526173]">
              Subscribe this WhatsApp Business Account to your Meta app. Use
              this after manual setup or to recover inbound message delivery.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={subscribeWebhooks}
          disabled={!canManage || !isConnected || isSubscribing}
          className={actionButtonClass()}
        >
          {isSubscribing ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Webhook className="mr-2 h-4 w-4" />
          )}
          {isSubscribing ? "Subscribing..." : "Subscribe Webhooks"}
        </button>
      </div>

      {!canManage ? (
        <p className="mt-4 rounded-xl border border-[#F8C830]/40 bg-[#F8C830]/15 p-3 text-sm text-[#102040]">
          Only owners and admins can subscribe WhatsApp webhooks.
        </p>
      ) : !isConnected ? (
        <p className="mt-4 rounded-xl bg-[#E7F8EF] p-3 text-sm text-[#526173] ring-1 ring-[#BFE9D0]">
          Connect a WABA and save its access token before subscribing webhooks.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
        >
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-[#22C55E]/25 bg-[#22C55E]/10 p-3 text-sm text-[#15803d]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </p>
      ) : null}
    </section>
  );
}
